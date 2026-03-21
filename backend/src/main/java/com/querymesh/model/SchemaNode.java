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
public class SchemaNode {
    private String tableName;
    private String schema;
    private List<String> columns;
    private List<String> indexes;
    private long rowCount;
}
