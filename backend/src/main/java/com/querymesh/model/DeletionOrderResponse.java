package com.querymesh.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class DeletionOrderResponse {
    private List<String> orderedTables;
    private boolean hasCycles;
    private List<String> cycleNodes;
    private String script;
}
