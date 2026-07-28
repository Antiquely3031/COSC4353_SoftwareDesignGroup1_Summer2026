-- This is a sample file to be use as a baseline for our databases we test ourselves, try to keep our own database as close as to this pls
CREATE DATABASE IF NOT EXISTS QueueSmartDB;
USE QueueSmartDB;

CREATE TABLE UserCredentials (
	user_ID INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    ROLE ENUM('User', 'Administrator') NOT NULL DEFAULT 'User',
    creationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE UserProfile (
	profile_ID INT AUTO_INCREMENT PRIMARY KEY,
    user_ID INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    preferences TEXT,
    
    CONSTRAINT fk_userprofile_credentials
        FOREIGN KEY (user_id)
        REFERENCES UserCredentials(user_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_userprofile_user
        UNIQUE (user_id),

    CONSTRAINT uq_userprofile_email
        UNIQUE (email)
);
CREATE TABLE Service (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    expected_duration INT NOT NULL,
    priority_level ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',

    CONSTRAINT chk_expected_duration
        CHECK (expected_duration > 0)
);

CREATE TABLE Queue (
    queue_id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_queue_service
        FOREIGN KEY (service_id)
        REFERENCES Service(service_id)
        ON DELETE CASCADE
);

CREATE TABLE QueueEntry (
    queue_entry_id INT AUTO_INCREMENT PRIMARY KEY,
    queue_id INT NOT NULL,
    user_id INT NOT NULL,
    position INT NOT NULL,
    join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('waiting', 'served', 'canceled') NOT NULL DEFAULT 'waiting',

    CONSTRAINT fk_queueentry_queue
        FOREIGN KEY (queue_id)
        REFERENCES Queue(queue_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_queueentry_user
        FOREIGN KEY (user_id)
        REFERENCES UserCredentials(user_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_queue_position
        CHECK (position > 0)
);

CREATE TABLE NotificationHistory (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('sent', 'viewed') NOT NULL DEFAULT 'sent',

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES UserCredentials(user_id)
        ON DELETE CASCADE
);
