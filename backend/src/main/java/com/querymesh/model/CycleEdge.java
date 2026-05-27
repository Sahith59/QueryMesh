package com.querymesh.model;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CycleEdge {
    private String from;
    private String to;
    private String constraint;
}
