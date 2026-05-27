package com.querymesh.controller;

import com.querymesh.model.*;
import com.querymesh.service.SchemaDriftService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/drift")
@RequiredArgsConstructor
public class SchemaDriftController {

    private final SchemaDriftService driftService;

    @PostMapping("/snapshot")
    public ResponseEntity<SnapshotSummary> takeSnapshot(@RequestBody SnapshotRequest request) {
        return ResponseEntity.ok(driftService.captureSnapshot(request.getLabel()));
    }

    @GetMapping("/snapshots")
    public ResponseEntity<List<SnapshotSummary>> listSnapshots() {
        return ResponseEntity.ok(driftService.listSnapshots());
    }

    @PostMapping("/diff")
    public ResponseEntity<SchemaDiff> computeDiff(@RequestBody DiffRequest request) {
        return ResponseEntity.ok(driftService.computeDiff(request.getFromId(), request.getToId()));
    }
}
