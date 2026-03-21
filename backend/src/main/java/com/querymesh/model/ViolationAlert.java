package com.querymesh.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ViolationAlert {
    private String table;
    private String column;
    private long orphanedRows;
    private String severity;
    private String suggestedFix;
    private String referencedTable;
    private String constraintName;
}
