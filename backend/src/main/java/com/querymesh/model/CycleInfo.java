package com.querymesh.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class CycleInfo {
    private List<String> path;
    private List<CycleEdge> edges;
    private String riskLevel;
    private String explanation;
}
