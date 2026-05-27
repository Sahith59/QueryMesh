package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SnapshotSummary {
    private int id;
    private String label;
    private String capturedAt;
    private int tableCount;
    private int relationshipCount;
}
