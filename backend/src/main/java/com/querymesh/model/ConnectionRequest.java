package com.querymesh.model;

import lombok.Data;

@Data
public class ConnectionRequest {
    private String host;
    private int port = 5432;
    private String database;
    private String username;
    private String password;
    /** postgresql | mysql | mariadb */
    private String dbType = "postgresql";
}
