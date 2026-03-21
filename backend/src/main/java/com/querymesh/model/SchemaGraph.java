package com.querymesh.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchemaGraph {
    private List<SchemaNode> nodes;
    private List<SchemaEdge> edges;
    private int totalTables;
    private int totalRelationships;
}
