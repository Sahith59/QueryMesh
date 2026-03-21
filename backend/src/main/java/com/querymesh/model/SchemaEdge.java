package com.querymesh.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SchemaEdge {
    private String from;           // child table
    private String to;             // parent table
    private String fromColumn;     // FK column in child
    private String toColumn;       // PK column in parent
    private String constraintName;
}
