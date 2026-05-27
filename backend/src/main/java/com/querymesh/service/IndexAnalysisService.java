package com.querymesh.service;

import com.querymesh.model.IndexGap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class IndexAnalysisService {

    private final JdbcTemplate jdbcTemplate;
    private final DbTypeHolder dbTypeHolder;

    public List<IndexGap> findIndexGaps() {
        String query = dbTypeHolder.isMySQL() ? mysqlQuery() : postgresqlQuery();
        return jdbcTemplate.query(query, (rs, rowNum) -> {
            String table  = rs.getString("table_name");
            String column = rs.getString("column_name");
            long rows     = rs.getLong("estimated_rows");
            String severity = rows > 10_000 ? "HIGH" : rows > 1_000 ? "MEDIUM" : "LOW";
            String indexName  = "idx_" + table + "_" + column;
            // MySQL doesn't support CONCURRENTLY
            String suggestion = dbTypeHolder.isMySQL()
                ? "CREATE INDEX " + indexName + " ON " + table + "(" + column + ");"
                : "CREATE INDEX CONCURRENTLY " + indexName + " ON " + table + "(" + column + ");";
            return IndexGap.builder()
                .table(table).column(column)
                .referencedTable(rs.getString("referenced_table"))
                .estimatedRows(rows).severity(severity)
                .suggestedIndex(suggestion)
                .build();
        });
    }

    private static String postgresqlQuery() {
        return """
            SELECT tbl.relname AS table_name, a.attname AS column_name,
                   ref.relname AS referenced_table,
                   GREATEST(COALESCE(s.n_live_tup, 0), GREATEST(tbl.reltuples::bigint, 0)) AS estimated_rows
            FROM pg_constraint c
            JOIN pg_class     tbl ON tbl.oid = c.conrelid
            JOIN pg_class     ref ON ref.oid = c.confrelid
            JOIN pg_namespace n   ON n.oid   = tbl.relnamespace
            JOIN pg_attribute a   ON a.attrelid = c.conrelid AND a.attnum = (c.conkey)[1]
            LEFT JOIN pg_stat_user_tables s ON s.relid = c.conrelid
            WHERE c.contype = 'f' AND n.nspname = 'public'
              AND NOT EXISTS (
                  SELECT 1 FROM pg_index i
                  WHERE i.indrelid = c.conrelid AND (c.conkey)[1] = i.indkey[0])
            ORDER BY estimated_rows DESC NULLS LAST
            """;
    }

    private static String mysqlQuery() {
        return """
            SELECT kcu.table_name, kcu.column_name,
                   kcu.referenced_table_name AS referenced_table,
                   COALESCE(t.table_rows, 0) AS estimated_rows
            FROM information_schema.key_column_usage kcu
            INNER JOIN information_schema.table_constraints tc
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
            LEFT JOIN information_schema.tables t
                ON t.table_name = kcu.table_name AND t.table_schema = kcu.table_schema
            WHERE kcu.referenced_table_name IS NOT NULL
              AND kcu.table_schema = DATABASE()
              AND NOT EXISTS (
                  SELECT 1 FROM information_schema.statistics s
                  WHERE s.table_schema = kcu.table_schema
                    AND s.table_name = kcu.table_name
                    AND s.column_name = kcu.column_name
                    AND s.seq_in_index = 1)
            ORDER BY estimated_rows DESC
            """;
    }
}
