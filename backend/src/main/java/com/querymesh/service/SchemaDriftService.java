package com.querymesh.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.querymesh.model.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SchemaDriftService {

    private final JdbcTemplate jdbcTemplate;
    private final SchemaIntrospectionService introspectionService;
    private final ObjectMapper objectMapper;

    @PostConstruct
    public void ensureTable() {
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS schema_snapshots (
                id          SERIAL PRIMARY KEY,
                label       VARCHAR(255),
                captured_at TIMESTAMP DEFAULT NOW(),
                snapshot    JSONB NOT NULL
            )
        """);
        log.info("schema_snapshots table ready");
    }

    public SnapshotSummary captureSnapshot(String label) {
        SchemaGraph graph = introspectionService.buildGraph();

        String json;
        try {
            json = objectMapper.writeValueAsString(graph);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize schema graph", e);
        }

        String effectiveLabel = (label != null && !label.isBlank())
                ? label.trim()
                : "Snapshot " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO schema_snapshots (label, snapshot) VALUES (?, ?::jsonb)",
                    new String[]{"id"});
            ps.setString(1, effectiveLabel);
            ps.setString(2, json);
            return ps;
        }, keyHolder);

        int id = Objects.requireNonNull(keyHolder.getKey()).intValue();
        return fetchSummary(id);
    }

    public List<SnapshotSummary> listSnapshots() {
        return jdbcTemplate.query("""
                SELECT id,
                       label,
                       captured_at,
                       (snapshot->>'totalTables')::int        AS table_count,
                       (snapshot->>'totalRelationships')::int AS rel_count
                FROM schema_snapshots
                ORDER BY captured_at DESC
                LIMIT 50
                """,
                (rs, rowNum) -> SnapshotSummary.builder()
                        .id(rs.getInt("id"))
                        .label(rs.getString("label"))
                        .capturedAt(rs.getTimestamp("captured_at").toLocalDateTime()
                                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                        .tableCount(rs.getInt("table_count"))
                        .relationshipCount(rs.getInt("rel_count"))
                        .build());
    }

    public SchemaDiff computeDiff(int fromId, int toId) {
        SchemaGraph fromGraph = loadGraph(fromId);
        SchemaGraph toGraph   = loadGraph(toId);
        SnapshotSummary fromMeta = fetchSummary(fromId);
        SnapshotSummary toMeta   = fetchSummary(toId);

        Map<String, SchemaNode> fromNodes = index(fromGraph.getNodes());
        Map<String, SchemaNode> toNodes   = index(toGraph.getNodes());

        List<String> tablesAdded   = toNodes.keySet().stream()
                .filter(t -> !fromNodes.containsKey(t)).sorted().collect(Collectors.toList());
        List<String> tablesRemoved = fromNodes.keySet().stream()
                .filter(t -> !toNodes.containsKey(t)).sorted().collect(Collectors.toList());

        List<ColumnChange> columnsAdded   = new ArrayList<>();
        List<ColumnChange> columnsRemoved = new ArrayList<>();
        List<IndexChange>  indexesAdded   = new ArrayList<>();
        List<IndexChange>  indexesRemoved = new ArrayList<>();

        for (String table : fromNodes.keySet()) {
            if (!toNodes.containsKey(table)) continue;
            SchemaNode fNode = fromNodes.get(table);
            SchemaNode tNode = toNodes.get(table);

            diff(fNode.getColumns(), tNode.getColumns())
                    .added().forEach(c -> columnsAdded.add(ColumnChange.builder().table(table).column(c).build()));
            diff(fNode.getColumns(), tNode.getColumns())
                    .removed().forEach(c -> columnsRemoved.add(ColumnChange.builder().table(table).column(c).build()));

            diff(fNode.getIndexes(), tNode.getIndexes())
                    .added().forEach(idx -> indexesAdded.add(IndexChange.builder().table(table).index(idx).build()));
            diff(fNode.getIndexes(), tNode.getIndexes())
                    .removed().forEach(idx -> indexesRemoved.add(IndexChange.builder().table(table).index(idx).build()));
        }

        Set<String> fromFkKeys = fromGraph.getEdges().stream()
                .map(SchemaEdge::getConstraintName).collect(Collectors.toSet());
        Set<String> toFkKeys = toGraph.getEdges().stream()
                .map(SchemaEdge::getConstraintName).collect(Collectors.toSet());

        List<FkChange> fksAdded = toGraph.getEdges().stream()
                .filter(e -> !fromFkKeys.contains(e.getConstraintName()))
                .map(e -> FkChange.builder().from(e.getFrom()).to(e.getTo())
                        .constraint(e.getConstraintName()).build())
                .collect(Collectors.toList());

        List<FkChange> fksRemoved = fromGraph.getEdges().stream()
                .filter(e -> !toFkKeys.contains(e.getConstraintName()))
                .map(e -> FkChange.builder().from(e.getFrom()).to(e.getTo())
                        .constraint(e.getConstraintName()).build())
                .collect(Collectors.toList());

        return SchemaDiff.builder()
                .from(fromMeta).to(toMeta)
                .tablesAdded(tablesAdded).tablesRemoved(tablesRemoved)
                .columnsAdded(columnsAdded).columnsRemoved(columnsRemoved)
                .fksAdded(fksAdded).fksRemoved(fksRemoved)
                .indexesAdded(indexesAdded).indexesRemoved(indexesRemoved)
                .build();
    }

    // ── helpers ──────────────────────────────────────────────────────

    private Map<String, SchemaNode> index(List<SchemaNode> nodes) {
        return nodes.stream().collect(Collectors.toMap(SchemaNode::getTableName, n -> n));
    }

    private SetDiff diff(List<String> from, List<String> to) {
        Set<String> f = new HashSet<>(from);
        Set<String> t = new HashSet<>(to);
        return new SetDiff(
                t.stream().filter(x -> !f.contains(x)).sorted().collect(Collectors.toList()),
                f.stream().filter(x -> !t.contains(x)).sorted().collect(Collectors.toList())
        );
    }

    private record SetDiff(List<String> added, List<String> removed) {}

    private SchemaGraph loadGraph(int id) {
        String json = jdbcTemplate.queryForObject(
                "SELECT snapshot::text FROM schema_snapshots WHERE id = ?", String.class, id);
        try {
            return objectMapper.readValue(json, SchemaGraph.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to deserialize snapshot " + id, e);
        }
    }

    private SnapshotSummary fetchSummary(int id) {
        return jdbcTemplate.queryForObject("""
                SELECT id,
                       label,
                       captured_at,
                       (snapshot->>'totalTables')::int        AS table_count,
                       (snapshot->>'totalRelationships')::int AS rel_count
                FROM schema_snapshots WHERE id = ?
                """,
                (rs, rowNum) -> SnapshotSummary.builder()
                        .id(rs.getInt("id"))
                        .label(rs.getString("label"))
                        .capturedAt(rs.getTimestamp("captured_at").toLocalDateTime()
                                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                        .tableCount(rs.getInt("table_count"))
                        .relationshipCount(rs.getInt("rel_count"))
                        .build(),
                id);
    }
}
