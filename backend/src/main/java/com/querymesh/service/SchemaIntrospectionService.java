package com.querymesh.service;

import com.querymesh.model.SchemaEdge;
import com.querymesh.model.SchemaGraph;
import com.querymesh.model.SchemaNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SchemaIntrospectionService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Get all user tables in the public schema with metadata.
     */
    public List<SchemaNode> getAllTables() {
        String tableQuery = """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """;

        List<SchemaNode> nodes = new ArrayList<>();

        jdbcTemplate.query(tableQuery, rs -> {
            String schema = rs.getString("table_schema");
            String tableName = rs.getString("table_name");

            List<String> columns = getColumnsForTable(tableName);
            List<String> indexes = getIndexesForTable(tableName);
            long rowCount = getRowCount(tableName);

            nodes.add(SchemaNode.builder()
                    .tableName(tableName)
                    .schema(schema)
                    .columns(columns)
                    .indexes(indexes)
                    .rowCount(rowCount)
                    .build());
        });

        return nodes;
    }

    /**
     * Get all FK relationships.
     */
    public List<SchemaEdge> getAllForeignKeys() {
        String fkQuery = """
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
        """;

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

    /**
     * Build the full dependency graph.
     */
    public SchemaGraph buildGraph() {
        List<SchemaNode> nodes = getAllTables();
        List<SchemaEdge> edges = getAllForeignKeys();

        return SchemaGraph.builder()
                .nodes(nodes)
                .edges(edges)
                .totalTables(nodes.size())
                .totalRelationships(edges.size())
                .build();
    }

    private List<String> getColumnsForTable(String tableName) {
        String query = """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ?
            ORDER BY ordinal_position
        """;

        return jdbcTemplate.queryForList(query, String.class, tableName);
    }

    private List<String> getIndexesForTable(String tableName) {
        String query = """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = ?
        """;

        return jdbcTemplate.queryForList(query, String.class, tableName);
    }

    private long getRowCount(String tableName) {
        try {
            // Use pg_stat estimate for performance (exact count is expensive on large tables)
            String query = """
                SELECT COALESCE(
                    (SELECT reltuples::bigint FROM pg_class
                     WHERE relname = ? AND relnamespace = (
                         SELECT oid FROM pg_namespace WHERE nspname = 'public'
                     )),
                    0
                )
            """;
            Long count = jdbcTemplate.queryForObject(query, Long.class, tableName);

            // If pg_stat returns -1 or 0 (table not yet analyzed), do exact count
            if (count == null || count <= 0) {
                // Safe: tableName comes from information_schema, not user input
                String exactQuery = "SELECT COUNT(*) FROM \"" + tableName + "\"";
                count = jdbcTemplate.queryForObject(exactQuery, Long.class);
            }
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Could not get row count for table: {}", tableName, e);
            return 0;
        }
    }
}
