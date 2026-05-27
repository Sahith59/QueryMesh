package com.querymesh.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class SchemaDiff {
    private SnapshotSummary from;
    private SnapshotSummary to;
    private List<String> tablesAdded;
    private List<String> tablesRemoved;
    private List<ColumnChange> columnsAdded;
    private List<ColumnChange> columnsRemoved;
    private List<FkChange> fksAdded;
    private List<FkChange> fksRemoved;
    private List<IndexChange> indexesAdded;
    private List<IndexChange> indexesRemoved;
}
