package com.querymesh.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationResult {
    private String tableName;
    private String columnName;
    private String referencedTable;
    private String referencedColumn;
    private String constraintName;
    private long orphanedRows;
    private String severity;       // LOW, MEDIUM, HIGH
    private String suggestedFix;
}
