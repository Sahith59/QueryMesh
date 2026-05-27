package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ScoreBreakdown {
    private String factor;
    private int score;
    private int maxScore;
    private String detail;
}
