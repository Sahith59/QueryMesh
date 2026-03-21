package com.querymesh.service;

import com.querymesh.model.DiagnoseResult;
import com.querymesh.model.SchemaEdge;
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
