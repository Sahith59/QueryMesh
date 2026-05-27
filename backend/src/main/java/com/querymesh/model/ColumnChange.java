package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ColumnChange {
    private String table;
    private String column;
}
