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
public class DiagnoseResult {
    private String tableName;
    private List<String> dependencyChain;
    private List<SchemaEdge> incomingForeignKeys;   // tables that reference this table
    private List<SchemaEdge> outgoingForeignKeys;   // tables this table references
    private int blastRadius;                         // number of tables affected by change
    private List<String> affectedTables;
}
