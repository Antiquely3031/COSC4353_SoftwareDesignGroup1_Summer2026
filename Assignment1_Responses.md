<!-- Repository Link: https://github.com/Antiquely3031/COSC4353_SoftwareDesignGroup1_Summer2026/tree/main -->
<!-- Patrick made the repository and the .md document, as well as wrote down the questions up to the second section, edited spelling and grammar in the responses, generated the System Context Diagram, and completed the "Overview Explanation" -->
<!-- I, Elvis, am the one who is editor/documentation guy (mainly formatting for now) -->

# Assignment 1: Design Analysis

## 1. Initial Thoughts

### Who are the main users of the system?
&emsp; The main users of QueueSmart are regular users and administrators. Regular users may include customers, students, 
patients, clients, or visitors who need to join a queue or schedule an appointment for a service. Administrators are staff 
members or managers who are responsible for creating services, monitoring queues, managing priorities, and improving the 
overall flow of service.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

<ul>
    <li>Regular Users : may include customers, students, patients, clients, or visitors who need to join a queue or schedule an appointment for a service.</li>
    <li>Administrators : staff members or managers who are responsible for creating services, monitoring queues, managing priorities, and improving the overall flow of service.</li>
</ul>

<!-- I, Elvis, wrote/made this response summary -->

### How will users and administrators interact with the application?
&emsp; Users will interact with QueueSmart by registering or logging in, selecting a service, joining a queue, viewing their
current position, checking their estimated wait time, and receiving notifications when their turn is approaching. 
Users may also leave the queue if they no longer need the service. Administrators will interact with QueueSmart through an admin
dashboard. They will be able to create and manage services, set expected service durations, assign priority levels, monitor active queues, update queue statuses, and view basic usage statistics.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

<ul>
    <li>Regular Users : Registering/logging into their Accounts, are able to join or leave a queue of their choosing, and view the general metrics regarding their position</li>
    <li>Administrators : Queue creation and management, publicly share desired metrics/information of a queue to the public and queuers, and view basic statistics of a given queue(s)</li>
</ul>

<!-- I, Elvis, wrote/made this response summary -->

### What are the most important features?
&emsp; The most important features are login and registration, role-based access, service management, queue joining and leaving, 
queue position tracking, estimated wait times, notifications, and queue history. These features are important because
they help users understand their wait time while helping administrators manage demand more efficiently.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

<table>
  <tr>
    <td>
      <ul>
          <li>Login and registration of account</li>
          <li>Role-based access</li>
          <li>service management</li>
          <li>Joining/leaving a queue</li>
      </ul>
    </td>
    <td>
      <ul>
          <li>Queue position tracking</li>
          <li>Estimated wait times</li>
          <li>Notifications</li>
          <li>Queue history</li>
      </ul>
    </td>
  </tr>
</table>

<!-- I, Elvis, wrote/made this response summary -->

### What challenges do you anticipate (e.g., long queues, notifications, inaccurate wait times)?
&emsp; Some challenges to expect include the following: long queues, inaccurate estimated wait times, users leaving
without updating their status, users missing their turn, and notifications not being sent at the right time.
Another challenge is balancing fairness with priority, since high-priority users may need to be served sooner while
keeping the queue fair for everyone else.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

<table>
  <tr>
    <td>
      <ul>
          <li>Long queues</li>
          <li>Inaccurate estimated wait times</li>
          <li>Users leaving without updating their status</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Users not responding to their turn</li>
        <li>Mistimed notifications</li>
        <li>Chance of queue starvation caused by tier/class system</li>
      </ul>
    </td>
  </tr>
</table>

<!-- I, Elvis, wrote/made this response summary -->

## 2. Development Methodology

### Which methodology will you follow (e.g., Agile, Scrum, Waterfall)?
&emsp; Our team plans to use an Agile development methodology for QueueSmart. Agile is a good fit for this project because
the application has multiple features that can be designed, reviewed, and improved over time, such as login and registration,
user roles, service management, queue management, notifications, and history tracking.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

##### Chosen Methodology: Agile

<!-- I, Elvis, wrote/made this response summary; then Kevin alter to fit current direction -->

### Why is this methodology appropriate for this project?
&emsp; This methodology is appropriate because QueueSmart may change as the team thinks more about user needs and administrator 
needs. For example, the team may first design the basic queue system, then later improve how priority levels, 
notifications, and estimated wait times work. Agile allows the team to make progress in smaller stages instead of waiting 
until the end to complete the entire design.

#### Summary | Quick Notes

<table>
  <tr>
    <td>
      <ul>
          <li>Accounting the potential shift in requirements</li>
      </ul>
    </td>
    <td>
      <ul>
        <li>Incremental approach towards development</li>
      </ul>
    </td>
  </tr>
</table>

<!-- I, Elvis, wrote/made this response summary -->

### How will this approach help your team work across multiple assignments?
&emsp; This approach will also help the team work across multiple assignments because each assignment can build on the 
previous one. Instead of starting over each time, the team can update and improve the QueueSmart design as more 
requirements are added. Agile also supports teamwork because the group can review progress often, share feedback, 
and adjust the design when needed.

<!-- Kevin wrote/made this response -->

#### Summary | Quick Notes

<ul>
  <li>Avoids/prevent member(s) from accidentally overwriting each others' work</li>
  <li>Ensuring every member is in general agreement with the project's current progress/state</li>
</ul>

<!-- I, Elvis, wrote/made this response summary -->

<!-- I, Elvis, wrote/made the third section and its subsection -->

## 3. High-Level Design / Architecture

<!-- Provide a high-level architecture of your proposed solution. -->

### Diagram(s)

Note: The architecture diagram, or any other diagrams, would also be provided as a standalone PDF or as a UML file. The types of UML files and their file extension(s) that are used or can be used by us, the contributors, are below: 

<table>
  <tr>
    <td>PlantUML</td>
    <td>*.wsd, *.puml, *.plantuml, or *.iuml</ul>
  </tr>
  <tr>
    <td>Mermaid</td>
    <td>directly in *.md, *.mmd, or *.mermaid</ul>
  </tr>
  <tr>
    <td>Draw.io</td>
    <td>*.drawio</td>
  </tr>
</table>

<!-- I, Elvis, retouch the note section to be more visiually more palable -->

#### Architecture Diagram
![System Context Diagram](./SystemContextDiagram.png)
<!-- I, Richard, created the Container Diagram using mermaid -->

#### Container Diagram
```mermaid
flowchart TD
    User["User\n(Customer)"]
    Admin["Administrator\n(Service Management)"]

    subgraph System ["QueueSmart System"]
        direction TB
        MobileApp["Mobile Application\n[Front-End]\nUI for tracking status"]
        API["API Application\n[Back-End]\nCore logic, queue math"]
        DB[("Database\n[Data Store]\nStores credentials, stats")]

        MobileApp -->|"API calls (HTTPS)"| API
        API -->|Read/Writes data| DB
    end

    subgraph External[" "]
        direction TB
        Notif["Notifications System\n[External: E-mail, SMS]"]
        Calendar["Calendar System\n[External: Sync]"]
    end
    style External fill:none,stroke:none
   
    User -->|Joins/leaves queue| MobileApp
    Admin -->|Manages queues| MobileApp

    API -.->|"Triggers alerts"| Notif
    API -.->|"Syncs appointments"| Calendar

    DummyLeft[" "] ~~~ API
    API ~~~ Notif
    style DummyLeft fill:none,stroke:none,color:transparent

    classDef external fill:#eee,stroke:#555,stroke-width:2px,color:#000;
    classDef internal fill:#87CEFA,stroke:#005c99,stroke-width:2px,color:#000;

    class Notif,Calendar external;
    class MobileApp,API,DB internal;
     
```

### Overview Explanation
#### QueueSmart Queue Management Service:
<ul>
    <li>User Interface (join/leave queue, track queue position, and track wait times)</li>
    <li>Administrator Interface (manage/create queues, manage interface/functions, track queue, and stat history)</li>
    <li>Notification Management (generate, push, and update)</li>
    <li>Settings</li>
    <li>Analytics</li>
</ul>

&emsp; The QueueSmart mobile app that this group will develop comprises a platform that verifies the authentication of users and administrators, oversees queue creation and scheduling, generates notifications for distribution through email and SMS, and provides settings and analytic components. Distribution of notifications and calendar updates will be provided via a service external to the app. The system is designed to allow users to join and monitor queues while enabling administrators to manage services, track queue activity, and analyze usage data through an administrative dashboard.

<!-- Patrick wrote/made the response -->

### Group 1 Members and Responsibilities Division

<table>
  <tr>
      <td>Student</td>
      <td>Contributions</td>
  </tr>
  <tr>
    <td>Patrick Callaghan</td>
    <td>Github repository creation, .md creation, System Context Diagram creation, and Overview Explanation. In addition, wrote the questions for the first two sections.</td>
  </tr>
  <tr>
    <td>Elvis Noel Trujillo Chairez</td>
    <td>Wrote the response summaries for the first two sections, and aided in the creation of the Architecture and System Container diagrams via setting/wrote up the third seciton and generated ideas with Patrick and Richard. In addition, being the main docmentation (formatting/presentation) lead and one of two editors (i.e. proof-reading/syntax formatting).</td>
  </tr>
  <tr>
    <td>Kevin Chau</td>
    <td>Wrote the responses and a summary in the first two sections. Helped to organize thoughts on discord for SCD and CD and guide discussion about overall flow of the project.</td>
  </tr>
  <tr>
    <td>Richard Tiamzon</td>
    <td>Container Diagram creation with mermaid, embedded SCD.png, and being the documentation assistant and one of the editors (i.e. proof-reading/syntax formatting).</td>
  </tr>
</table>

<!-- I, Elvis, did a massive retouch up of the list -- now table, and added more detail to what contribution we did from what I could gather from our discord and github commit history(ies) of all branches -- mainly the main branch. -->
