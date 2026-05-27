package com.querymesh.service;

import com.querymesh.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiagnosticService {

    private final SchemaIntrospectionService introspectionService;

    /**
     * Diagnose a table: find its dependency chain, FK constraints in/out, and blast radius.
     */
    public DiagnoseResult diagnose(String tableName) {
        List<SchemaEdge> allEdges = introspectionService.getAllForeignKeys();

        // Incoming FKs: other tables that reference this table
        List<SchemaEdge> incoming = allEdges.stream()
                .filter(e -> e.getTo().equalsIgnoreCase(tableName))
                .collect(Collectors.toList());

        // Outgoing FKs: tables this table references
        List<SchemaEdge> outgoing = allEdges.stream()
                .filter(e -> e.getFrom().equalsIgnoreCase(tableName))
                .collect(Collectors.toList());

        // Build dependency chain using BFS
        List<String> dependencyChain = buildDependencyChain(tableName, allEdges);

        // Blast radius: all tables that would be affected by a schema change
        Set<String> affectedTables = calculateBlastRadius(tableName, allEdges);

        return DiagnoseResult.builder()
                .tableName(tableName)
                .dependencyChain(dependencyChain)
                .incomingForeignKeys(incoming)
                .outgoingForeignKeys(outgoing)
                .blastRadius(affectedTables.size())
                .affectedTables(new ArrayList<>(affectedTables))
                .build();
    }

    // ──────────────────────────────────────────────────────────────────
    // Circular Dependency Detection (DFS / 3-colour)
    // ──────────────────────────────────────────────────────────────────

    public CircularDepsResult detectCircularDeps() {
        List<SchemaEdge> allEdges = introspectionService.getAllForeignKeys();
        List<SchemaNode>  allNodes = introspectionService.getAllTables();
        List<String> tables = allNodes.stream().map(SchemaNode::getTableName).collect(Collectors.toList());

        // Build adjacency list: node -> outgoing edges
        Map<String, List<SchemaEdge>> adj = new HashMap<>();
        for (String t : tables) adj.put(t, new ArrayList<>());
        for (SchemaEdge e : allEdges) {
            adj.computeIfAbsent(e.getFrom(), k -> new ArrayList<>()).add(e);
        }

        // 0 = WHITE (unvisited), 1 = GRAY (in current path), 2 = BLACK (done)
        Map<String, Integer> color = new HashMap<>();
        for (String t : tables) color.put(t, 0);

        List<CycleInfo> cycles = new ArrayList<>();
        Set<String> reportedCycleKeys = new HashSet<>();

        for (String table : tables) {
            if (color.get(table) == 0) {
                Deque<String> path = new ArrayDeque<>();
                dfs(table, adj, color, path, allEdges, cycles, reportedCycleKeys);
            }
        }

        return CircularDepsResult.builder()
                .hasCycles(!cycles.isEmpty())
                .cycles(cycles)
                .build();
    }

    private void dfs(String node,
                     Map<String, List<SchemaEdge>> adj,
                     Map<String, Integer> color,
                     Deque<String> path,
                     List<SchemaEdge> allEdges,
                     List<CycleInfo> cycles,
                     Set<String> reportedCycleKeys) {

        color.put(node, 1); // GRAY
        path.addLast(node);

        for (SchemaEdge edge : adj.getOrDefault(node, Collections.emptyList())) {
            String neighbor = edge.getTo();
            int neighborColor = color.getOrDefault(neighbor, 0);

            if (neighborColor == 1) {
                // Back-edge found — extract cycle
                extractCycle(neighbor, path, edge, allEdges, cycles, reportedCycleKeys);
            } else if (neighborColor == 0) {
                dfs(neighbor, adj, color, path, allEdges, cycles, reportedCycleKeys);
            }
        }

        path.removeLast();
        color.put(node, 2); // BLACK
    }

    private void extractCycle(String cycleStart,
                               Deque<String> path,
                               SchemaEdge closingEdge,
                               List<SchemaEdge> allEdges,
                               List<CycleInfo> cycles,
                               Set<String> reportedCycleKeys) {

        // Extract just the cycle portion from path
        List<String> pathList = new ArrayList<>(path);
        int startIdx = pathList.lastIndexOf(cycleStart);
        if (startIdx < 0) return; // safety

        List<String> cyclePath = new ArrayList<>(pathList.subList(startIdx, pathList.size()));
        cyclePath.add(cycleStart); // close the loop

        // Normalise: start from alphabetically smallest node to deduplicate
        String minNode = cyclePath.subList(0, cyclePath.size() - 1)
                .stream().min(Comparator.naturalOrder()).orElse(cycleStart);
        int minIdx = cyclePath.indexOf(minNode);
        List<String> normalised = new ArrayList<>();
        for (int i = 0; i < cyclePath.size() - 1; i++) {
            normalised.add(cyclePath.get((minIdx + i) % (cyclePath.size() - 1)));
        }
        normalised.add(normalised.get(0));

        String key = String.join("->", normalised);
        if (reportedCycleKeys.contains(key)) return;
        reportedCycleKeys.add(key);

        // Resolve edges for the cycle path
        Map<String, SchemaEdge> edgeLookup = new HashMap<>();
        for (SchemaEdge e : allEdges) {
            edgeLookup.put(e.getFrom() + "|" + e.getTo(), e);
        }

        List<CycleEdge> cycleEdges = new ArrayList<>();
        for (int i = 0; i < normalised.size() - 1; i++) {
            String from = normalised.get(i);
            String to   = normalised.get(i + 1);
            SchemaEdge e = edgeLookup.get(from + "|" + to);
            cycleEdges.add(CycleEdge.builder()
                    .from(from)
                    .to(to)
                    .constraint(e != null ? e.getConstraintName() : "unknown")
                    .build());
        }

        boolean isSelfRef = normalised.size() == 2 && normalised.get(0).equals(normalised.get(1));
        String explanation = isSelfRef
                ? "Self-referencing FK on \"" + cycleStart + "\". TRUNCATE requires DISABLE TRIGGER ALL."
                : "Circular FK prevents safe TRUNCATE on any table in this cycle. "
                  + "Cascade deletes may deadlock. Some ORMs reject this schema.";

        cycles.add(CycleInfo.builder()
                .path(normalised)
                .edges(cycleEdges)
                .riskLevel("HIGH")
                .explanation(explanation)
                .build());
    }

    /**
     * Build the dependency chain from the target table outward (BFS).
     * Shows: tableName → parent tables → their parents → ...
     */
    private List<String> buildDependencyChain(String tableName, List<SchemaEdge> allEdges) {
        List<String> chain = new ArrayList<>();
        Set<String> visited = new LinkedHashSet<>();
        Queue<String> queue = new LinkedList<>();

        queue.add(tableName);
        visited.add(tableName.toLowerCase());

        while (!queue.isEmpty()) {
            String current = queue.poll();
            chain.add(current);

            // Find tables that this table references (outgoing FKs)
            for (SchemaEdge edge : allEdges) {
                if (edge.getFrom().equalsIgnoreCase(current)
                        && !visited.contains(edge.getTo().toLowerCase())) {
                    visited.add(edge.getTo().toLowerCase());
                    queue.add(edge.getTo());
                }
            }
        }

        return chain;
    }

    /**
     * Calculate blast radius: all tables transitively affected by a change to the target table.
     * Includes both tables that depend on this table AND tables this table depends on.
     */
    private Set<String> calculateBlastRadius(String tableName, List<SchemaEdge> allEdges) {
        Set<String> affected = new LinkedHashSet<>();
        Queue<String> queue = new LinkedList<>();

        queue.add(tableName);

        while (!queue.isEmpty()) {
            String current = queue.poll();

            // Tables that reference this table (would break if this table changes)
            for (SchemaEdge edge : allEdges) {
                if (edge.getTo().equalsIgnoreCase(current)
                        && !affected.contains(edge.getFrom().toLowerCase())) {
                    affected.add(edge.getFrom().toLowerCase());
                    queue.add(edge.getFrom());
                }
            }

            // Tables this table references (upstream dependencies)
            for (SchemaEdge edge : allEdges) {
                if (edge.getFrom().equalsIgnoreCase(current)
                        && !affected.contains(edge.getTo().toLowerCase())) {
                    affected.add(edge.getTo().toLowerCase());
                    queue.add(edge.getTo());
                }
            }
        }

        // Remove self from affected set
        affected.remove(tableName.toLowerCase());
        return affected;
    }
}
