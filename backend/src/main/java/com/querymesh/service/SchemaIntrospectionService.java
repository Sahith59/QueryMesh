package com.querymesh.service;

import com.querymesh.model.SchemaEdge;
import com.querymesh.model.SchemaGraph;
import com.querymesh.model.SchemaNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SchemaIntrospectionService {

    private final JdbcTemplate jdbcTemplate;
    private final DbTypeHolder dbTypeHolder;

    public List<SchemaNode> getAllTables() {
        String schemaFilter = dbTypeHolder.isMySQL()
            ? "table_schema = DATABASE()"
            : "table_schema = 'public'";

        String tableQuery = """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE %s AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """.formatted(schemaFilter);

        List<SchemaNode> nodes = new ArrayList<>();
        jdbcTemplate.query(tableQuery, rs -> {
            String schema    = rs.getString("table_schema");
            String tableName = rs.getString("table_name");
            nodes.add(SchemaNode.builder()
                .tableName(tableName)
                .schema(schema)
                .columns(getColumnsForTable(tableName))
                .indexes(getIndexesForTable(tableName))
                .rowCount(getRowCount(tableName))
                .build());
        });
        return nodes;
    }

    public List<SchemaEdge> getAllForeignKeys() {
        String fkQuery = dbTypeHolder.isMySQL() ? mysqlFkQuery() : postgresqlFkQuery();
        return jdbcTemplate.query(fkQuery, (rs, rowNum) ->
            SchemaEdge.builder()
                .from(rs.getString("table_name"))
                .to(rs.getString("foreign_table_name"))
                .fromColumn(rs.getString("column_name"))
                .toColumn(rs.getString("foreign_column_name"))
                .constraintName(rs.getString("constraint_name"))
                .build()
        );
    }

    public SchemaGraph buildGraph() {
        List<SchemaNode> nodes = getAllTables();
        List<SchemaEdge> edges = getAllForeignKeys();
        return SchemaGraph.builder()
            .nodes(nodes).edges(edges)
            .totalTables(nodes.size()).totalRelationships(edges.size())
            .build();
    }

    private List<String> getColumnsForTable(String tableName) {
        String schemaFilter = dbTypeHolder.isMySQL() ? "DATABASE()" : "'public'";
        String query = """
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = %s AND table_name = ?
            ORDER BY ordinal_position
            """.formatted(schemaFilter);
        return jdbcTemplate.queryForList(query, String.class, tableName);
    }

    private List<String> getIndexesForTable(String tableName) {
        if (dbTypeHolder.isMySQL()) {
            String q = """
                SELECT DISTINCT index_name FROM information_schema.statistics
                WHERE table_schema = DATABASE() AND table_name = ?
                """;
            return jdbcTemplate.queryForList(q, String.class, tableName);
        }
        String q = "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = ?";
        return jdbcTemplate.queryForList(q, String.class, tableName);
    }

    private long getRowCount(String tableName) {
        try {
            if (dbTypeHolder.isMySQL()) {
                String q = """
                    SELECT COALESCE(table_rows, 0) FROM information_schema.tables
                    WHERE table_schema = DATABASE() AND table_name = ?
                    """;
                Long count = jdbcTemplate.queryForObject(q, Long.class, tableName);
                return count != null ? count : 0;
            }
            // PostgreSQL: use pg_stat estimate, fall back to COUNT(*)
            String q = """
                SELECT COALESCE(
                    (SELECT reltuples::bigint FROM pg_class
                     WHERE relname = ? AND relnamespace = (
                         SELECT oid FROM pg_namespace WHERE nspname = 'public')),0)
                """;
            Long count = jdbcTemplate.queryForObject(q, Long.class, tableName);
            if (count == null || count <= 0) {
                count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM \"" + tableName + "\"", Long.class);
            }
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Could not get row count for {}: {}", tableName, e.getMessage());
            return 0;
        }
    }

    private static String postgresqlFkQuery() {
        return """
            SELECT tc.constraint_name, tc.table_name, kcu.column_name,
                   ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            """;
    }

    private static String mysqlFkQuery() {
        return """
            SELECT kcu.constraint_name, kcu.table_name, kcu.column_name,
                   kcu.referenced_table_name AS foreign_table_name,
                   kcu.referenced_column_name AS foreign_column_name
            FROM information_schema.key_column_usage kcu
            INNER JOIN information_schema.table_constraints tc
                ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
               AND tc.table_name = kcu.table_name
            WHERE kcu.referenced_table_name IS NOT NULL
              AND kcu.table_schema = DATABASE()
            """;
    }
}
