package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class IndexGap {
    private String table;
    private String column;
    private String referencedTable;
    private long estimatedRows;
    private String severity;
    private String suggestedIndex;
}
