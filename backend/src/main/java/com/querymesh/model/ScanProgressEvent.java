package com.querymesh.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScanProgressEvent {
    private String currentTable;
    private int tablesScanned;
    private int totalTables;
    private int violationsFound;
    private String status; // SCANNING, COMPLETE, ERROR
}
