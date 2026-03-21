package com.querymesh.controller;

import com.querymesh.service.ViolationScannerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/scan")
@RequiredArgsConstructor
public class ScanController {

    private final ViolationScannerService violationScannerService;

    /**
     * POST /api/scan/start — triggers async scan with WebSocket progress events
     */
    @PostMapping("/start")
    public ResponseEntity<Map<String, String>> startScan() {
        violationScannerService.scanWithWebSocket();
        return ResponseEntity.ok(Map.of(
                "status", "STARTED",
                "message", "Scan started. Subscribe to /topic/scan-progress and /topic/violations for updates."
        ));
    }
}
