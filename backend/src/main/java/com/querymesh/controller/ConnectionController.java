package com.querymesh.controller;

import com.querymesh.config.DataSourceConfig;
import com.querymesh.model.ConnectionRequest;
import com.querymesh.service.DbTypeHolder;
import com.zaxxer.hikari.HikariDataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.aop.target.HotSwappableTargetSource;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.util.Map;

@RestController
@RequestMapping("/api/schema")
@RequiredArgsConstructor
@Slf4j
public class ConnectionController {

    private final HotSwappableTargetSource dataSourceTargetSource;
    private final DbTypeHolder dbTypeHolder;

    @PostMapping("/connect")
    public ResponseEntity<Map<String, Object>> connect(@RequestBody ConnectionRequest req) {
        String dbType = req.getDbType() == null ? "postgresql" : req.getDbType().toLowerCase();
        String url = DataSourceConfig.buildJdbcUrl(dbType, req.getHost(), req.getPort(), req.getDatabase());
        log.info("Switching datasource to {} ({})", url, dbType);

        HikariDataSource newDs = null;
        try {
            newDs = DataSourceConfig.buildDataSource(url, req.getUsername(), req.getPassword());
            JdbcTemplate probe = new JdbcTemplate(newDs);

            // Count tables — use DB-appropriate query
            String countSql = dbType.equals("postgresql")
                ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
                : "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'";

            Integer tableCount = probe.queryForObject(countSql, Integer.class);

            // Hot-swap datasource
            DataSource old = (DataSource) dataSourceTargetSource.swap(newDs);
            if (old instanceof HikariDataSource hds) hds.close();

            // Update dialect holder
            dbTypeHolder.set(switch (dbType) {
                case "mysql"   -> DbTypeHolder.DbType.MYSQL;
                case "mariadb" -> DbTypeHolder.DbType.MARIADB;
                default        -> DbTypeHolder.DbType.POSTGRESQL;
            });

            log.info("Connection switched to {} ({}). Tables: {}", req.getDatabase(), dbType, tableCount);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Connected successfully",
                "tableCount", tableCount != null ? tableCount : 0,
                "database", req.getDatabase(),
                "host", req.getHost(),
                "dbType", dbType
            ));

        } catch (Exception e) {
            if (newDs != null) try { newDs.close(); } catch (Exception ignored) {}
            log.warn("Connection failed: {}", e.getMessage());
            String msg = friendlyError(e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", msg
            ));
        }
    }

    private static String friendlyError(String raw) {
        if (raw == null) return "Connection failed";
        if (raw.contains("password") || raw.contains("authentication"))
            return "Authentication failed — check username/password";
        if (raw.contains("Connection refused") || raw.contains("connect timed out") || raw.contains("No route"))
            return "Cannot reach host — check host and port";
        if (raw.contains("database") || raw.contains("Unknown database"))
            return "Database not found — check the database name";
        if (raw.contains("SSL"))
            return "SSL error — try disabling SSL in connection options";
        return raw.length() > 120 ? raw.substring(0, 120) + "…" : raw;
    }
}
