package com.querymesh.service;

import com.querymesh.model.DeletionOrderResponse;
import com.querymesh.model.SchemaEdge;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DeletionOrderService {

    private final SchemaIntrospectionService introspectionService;

    public DeletionOrderResponse computeDeletionOrder(List<String> requestedTables) {
        Set<String> selectedSet = new LinkedHashSet<>(requestedTables);
        List<SchemaEdge> allEdges = introspectionService.getAllForeignKeys();

        Map<String, List<String>> adjacency = new HashMap<>();
        Map<String, Integer> inDegree = new HashMap<>();

        for (String table : selectedSet) {
            adjacency.put(table, new ArrayList<>());
            inDegree.put(table, 0);
        }

        // edge.from has FK -> edge.to (child -> parent)
        // To delete safely: delete child (from) before parent (to)
        // Deletion graph edge: from -> to (from comes first)
        for (SchemaEdge edge : allEdges) {
            String from = edge.getFrom();
            String to = edge.getTo();
            if (selectedSet.contains(from) && selectedSet.contains(to) && !from.equals(to)) {
                adjacency.get(from).add(to);
                inDegree.merge(to, 1, Integer::sum);
            }
        }

        // Kahn's algorithm — deterministic ordering with sorted initial queue
        Queue<String> queue = new PriorityQueue<>(Comparator.naturalOrder());
        for (String table : selectedSet) {
            if (inDegree.get(table) == 0) {
                queue.offer(table);
            }
        }

        List<String> orderedTables = new ArrayList<>();
        while (!queue.isEmpty()) {
            String current = queue.poll();
            orderedTables.add(current);
            for (String neighbor : adjacency.get(current)) {
                int remaining = inDegree.merge(neighbor, -1, Integer::sum);
                if (remaining == 0) {
                    queue.offer(neighbor);
                }
            }
        }

        boolean hasCycles = orderedTables.size() != selectedSet.size();
        List<String> cycleNodes = new ArrayList<>();
        if (hasCycles) {
            for (String table : selectedSet) {
                if (!orderedTables.contains(table)) {
                    cycleNodes.add(table);
                }
            }
        }

        String script = buildScript(orderedTables, cycleNodes, hasCycles);

        return DeletionOrderResponse.builder()
                .orderedTables(orderedTables)
                .hasCycles(hasCycles)
                .cycleNodes(cycleNodes)
                .script(script)
                .build();
    }

    private String buildScript(List<String> orderedTables, List<String> cycleNodes, boolean hasCycles) {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        StringBuilder sb = new StringBuilder();
        sb.append("-- Safe deletion order computed by QueryMesh\n");
        sb.append("-- Generated: ").append(timestamp).append("\n");

        if (hasCycles) {
            sb.append("--\n");
            sb.append("-- WARNING: Circular FK dependencies detected.\n");
            sb.append("-- Affected tables: ").append(String.join(", ", cycleNodes)).append("\n");
            sb.append("-- These tables require manual handling (DISABLE TRIGGER ALL).\n");
        }

        sb.append("\nBEGIN;\n\n");

        if (hasCycles && !cycleNodes.isEmpty()) {
            sb.append("-- === Circular FK tables (manual intervention required) ===\n");
            for (String table : cycleNodes) {
                sb.append("ALTER TABLE \"").append(table).append("\" DISABLE TRIGGER ALL;\n");
                sb.append("DELETE FROM \"").append(table).append("\";\n");
                sb.append("ALTER TABLE \"").append(table).append("\" ENABLE TRIGGER ALL;\n\n");
            }
        }

        if (!orderedTables.isEmpty()) {
            sb.append("-- === Safe deletion order (FK-respecting) ===\n");
            for (String table : orderedTables) {
                sb.append("DELETE FROM \"").append(table).append("\";\n");
            }
        }

        sb.append("\nCOMMIT;\n");
        return sb.toString();
    }
}
