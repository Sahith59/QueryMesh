package com.querymesh.model;

import lombok.Data;
import java.util.List;

@Data
public class DeletionOrderRequest {
    private List<String> tables;
}
