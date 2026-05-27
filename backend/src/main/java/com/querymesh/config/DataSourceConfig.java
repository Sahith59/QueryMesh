package com.querymesh.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.aop.target.HotSwappableTargetSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
public class DataSourceConfig {

    @Bean
    public HotSwappableTargetSource dataSourceTargetSource(
        @Value("${spring.datasource.url}") String url,
        @Value("${spring.datasource.username}") String username,
        @Value("${spring.datasource.password}") String password
    ) {
        return new HotSwappableTargetSource(buildDataSource(url, username, password));
    }

    @Bean
    @Primary
    public DataSource dataSource(HotSwappableTargetSource targetSource) {
        ProxyFactory pf = new ProxyFactory();
        pf.setTargetSource(targetSource);
        pf.addInterface(DataSource.class);
        return (DataSource) pf.getProxy();
    }

    public static HikariDataSource buildDataSource(String jdbcUrl, String username, String password) {
        HikariConfig cfg = new HikariConfig();
        cfg.setJdbcUrl(jdbcUrl);
        cfg.setUsername(username);
        cfg.setPassword(password);
        cfg.setMaximumPoolSize(5);
        cfg.setMinimumIdle(1);
        cfg.setConnectionTimeout(10_000);
        cfg.setValidationTimeout(5_000);

        if (jdbcUrl.contains(":mysql:"))    cfg.setDriverClassName("com.mysql.cj.jdbc.Driver");
        else if (jdbcUrl.contains(":mariadb:")) cfg.setDriverClassName("org.mariadb.jdbc.Driver");
        else                                cfg.setDriverClassName("org.postgresql.Driver");

        return new HikariDataSource(cfg);
    }

    /** Build JDBC URL from individual components */
    public static String buildJdbcUrl(String dbType, String host, int port, String database) {
        return switch (dbType.toLowerCase()) {
            case "mysql"   -> String.format("jdbc:mysql://%s:%d/%s?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC", host, port, database);
            case "mariadb" -> String.format("jdbc:mariadb://%s:%d/%s", host, port, database);
            default        -> String.format("jdbc:postgresql://%s:%d/%s", host, port, database);
        };
    }
}
