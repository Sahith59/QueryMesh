package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IndexChange {
    private String table;
    private String index;
}
