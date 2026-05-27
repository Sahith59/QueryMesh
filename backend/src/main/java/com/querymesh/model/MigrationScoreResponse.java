package com.querymesh.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class MigrationScoreResponse {
    private String tableName;
    private String changeType;
    private int score;
    private String riskLevel;
    private List<ScoreBreakdown> breakdown;
    private List<String> warnings;
    private List<String> checklist;
}
