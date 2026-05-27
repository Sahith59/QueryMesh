package com.querymesh.service;

import org.springframework.stereotype.Component;

@Component
public class DbTypeHolder {

    public enum DbType { POSTGRESQL, MYSQL, MARIADB }

    private volatile DbType current = DbType.POSTGRESQL;

    public DbType get() { return current; }
    public void set(DbType type) { this.current = type; }

    public boolean isMySQL() {
        return current == DbType.MYSQL || current == DbType.MARIADB;
    }

    /** SQL expression that returns the current schema/database name */
    public String schemaExpr() {
        return isMySQL() ? "DATABASE()" : "'public'";
    }
}
