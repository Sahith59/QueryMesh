package com.querymesh.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class CircularDepsResult {
    private boolean hasCycles;
    private List<CycleInfo> cycles;
}
