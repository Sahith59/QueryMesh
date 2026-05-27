package com.querymesh.model;

import lombok.Data;

@Data
public class MigrationScoreRequest {
    private String tableName;
    private String changeType;
    private String details;
}
