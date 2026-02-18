# 🏛 Umuturage Administrative Management System (Backend)

## 📌 Overview

Umuturage Backend is a RESTful API built with Node.js and Express, designed to power a hierarchical administrative management system.

The system manages residency data and structured reports across multiple government levels:

Isibo → Village (Umudugudu) → Cell → Sector → District → Province

Data originates from lower administrative levels and moves upward through a controlled approval workflow, ensuring transparency, traceability, and structured governance.



## 🎯 System Objectives

- Centralize residency data management
- Enable hierarchical report submission and validation
- Enforce role-based access control
- Maintain data integrity across administrative levels
- Provide scalable and secure API endpoints



## 🛠 Tech Stack

### 🔹 Backend
- Node.js
- Express.js

### 🔹 Database
- PostgreSQL

### 🔹 Architecture Style
- RESTful API design
- Modular route/controller structure
- Middleware-based authentication & authorization
- Role-based access control (RBAC)



## 🏗 System Architecture

The backend follows a layered structure:

- Routes → Controllers → Services → Database
- Middleware for authentication and role validation
- PostgreSQL for relational data management
- Structured foreign key relationships for administrative hierarchy



## 📊 Core Functional Modules

### 👤 Authentication & Authorization
- User login
- Role assignment (Isibo, Village, Cell, Sector, District, Province)
- Protected routes via middleware

### 🏠 Residency Management
- Create resident records
- Update residency information
- Track administrative unit association

### 📄 Report Management
- Submit reports from lower levels
- Forward reports upward
- Approve or reject reports
- Track report status lifecycle

### 🏛 Administrative Hierarchy Management
- Districts
- Sectors
- Cells
- Villages
- Isibos

Each level is relationally connected via foreign keys.



## 🗄 Database Structure (Simplified)

Core tables include:

- users
- roles
- provinces
- districts
- sectors
- cells
- villages
- isibos
- households 
- reports

Relational integrity is enforced using PostgreSQL constraints.



## 🔄 Workflow Logic

1. User logs in.
2. Role determines accessible administrative scope.
3. Lower-level admin submits data or report.
4. Higher-level admin reviews submission.
5. Approval or rejection updates report status.
6. Status propagates upward through the system.


## 🔐 Security Features

- Middleware-based route protection
- Role-based access control
- Input validation
- Structured error handling
- Secure database queries
- Environment-based configuration



