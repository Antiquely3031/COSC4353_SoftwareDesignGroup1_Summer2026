# General Instructions for the Admin Portion

## Disclaimer: This only works for localhost setup and simply testing the core features of the Admin Domain

<ol>
    <li>Set up the database.<strong>*1</strong></li>
    <li>Run on connection the following two *.sql files within QSAdminDB folder: QSAdminDBTransActs and QSAdminDBQuey.</li>
    <li>Go to either Assignment 2 or 3 folder and open/preview of html in your IDE/text editor (such as VS Code) a Admin related HTML such as AdminDash.html.<strong>*2</strong></li>
    <li>Go to the Assignment 3 folder, and start up QSAdminBackend.js.<strong>*3</strong></li>
    <li>There, you can informally test/try out the required features such as reordering clients, editing/create/deleting servrices, or even the basic funciton of either opening or closing a service.<strong>*4</strong>
</ol>

### For the asterisks (^*\d)

<ol>
    <li>If you, or y'all, already created the queuesmartdb database; then y'all should be fine as I based my procedures and that single view based on the one in QS_DB.sql in the Assignment 4 folder. In addition, my backend poriton only deals with really three tables for now: Service, Queue, and Queue_Entry. The addition of a select for the single view to reach into the UserProfile and UserCredentials to get the name of client wouldn't be so hard, and that would be added in the very last assignment. One more thing, ensure that y'all use your own <strong>*.env</strong> when running it as I google/Gemini it that one shouldn't upload their own *.env; plus, I used mysql2 as well. So yeah.</li>
    <li>Preferrably that you, or y'all, go to the Assignment 2 folder as I make update there as the project progress, and then I transfer those changes into the other folder if they have copy of those very same files in there; sometimes, I forget, okay.</li>
    <li>By the way, there is a constant variable called <strong>"Initial_Gen_Reset_Key"</strong>, and that variable controls whether the backend (via the only composite procedure <strong>"Mock_Initialization_Generation"</strong>) generates a decent amount of mock data into the database. But also, that variable deletes every tuple within those tables mentioned when the key is left on true. Therefore, in order to test persistence, set the variable truth value to false.</li>
    <li>Y'all know the drill, you can use SQL commands to quickly check into the tables after a operation even with the server running. But after every interaction -- mainly the Queue Management portion -- did does take a very very very brief time to do a transaction. Also, run the same select command after a or a set of actions such as serving or removing client(s).</li>
</ol>

### Additional/Development Notes

#### Helped in merging

&emsp; By the way, I was the one who merge the main into Kevin's branch twice. The first time was when Kevin's branch was about 320 so commits behind the main branch, and he asked us to help him update his branch; i offered and helped him out. Though there was an instance of QS-User.js that was the cause of the problem -- merge conflicts. The second time was about when his branch about to be 50 commits behind, and I decided to be proactived about it; so I merge the main into his, his into main, and main into my branch: <strong>Elvis-The-Avian-Line</strong>. I like to my bench fresh. But I did encounter four merge conflicts: two delete files, a JS file (perhaps frontend), and an instance of QS-User.js (mostly like from assignment 2 folder; IDK/forgot). Mainly just kept the change that is already there in his branch.

&emsp; In addition, from the looks, I'm the only one who is using their IDE/text editor of choice (in my case being Visual Studio Code) to directly commit, push, pull, and merge freely since the beginning of the project. So that is the main reason that I offered my help; as the others already know that I was able to freely merge the main and my branch into each other. Plus, Kevin did say that his computer won't let him merge/interact with the repo directly due to not having the "permissions".

&emsp; Overall, I could constantly merge the branches for the others; is just most times. I don't want to as I don't to effectively "step on their toes". Same reasoning for the silo effect in development; it's just a pain to relearn one's own code after someone alters it -- especially after one didn't see it in action.

##### Use GitHub's GUI/Read Canvas' Assignment Description like a Fae (Fairy)

Like the title indirectly say, use your reading skill, basic pattern recognition skills, and critical thinking skills.

> [...] Please avoid making updates to past assignments after their deadlines. I let it slide this time because the changes appeared to be only file reorganization and did not modify the assignment content, but please be careful going forward :)
>
> -- Fatima Ezzahra El Aidos | Jul 25 at 6:55pm

Go to our commit history GUI in Github, and use the <strong>"<>"</strong> button to check the state of the repo at that very commit; hell, click on the dropdown calander, select the due of the given assignment, and then click on the last commit of that day. Then what is the point of using GitHub in the first place. But overall no to very tiny amount of beef/peevishness with the feedback/grader.

> only 2 people contributed to this assignment on github.
>
> -- Tina Mley Nartey | Jul 27 at 5:56pm

First off,for your information, Kevin's got his grade fixed, but Richard hadn't; that is what I know from the last time I looked at our discord group chat. Use GitHub's commit history GUI more often as there is as well; in addition, the README of the repo has the table matching the GitHub's usernames to the actual person. In addition, Richard told us that apparently the grader/re-grader couldn't easily find his commit even though the aforementioned BCNF table in the repo's README and the user filter option in the commit history section of GitHub is literally right there.

>Good overall backend submission with an accessible GitHub repository, clearly explained technology choices, meaningful contributions from all four team members, and strong automated testing. Authentication, service administration, administrator queue handling, and notifications are implemented well.
>
> The primary issue is incomplete end-to-end integration. The user-side queue and history screens still rely largely on static data and localStorage, while the QueueService logic is not exposed through a backend API. In addition, the authentication and administrator backends use separate servers that default to the same port. The backend modules should be consolidated or configured to run together, and all queue, wait-time, and history information displayed in the A2 frontend should come from backend responses. Repository hygiene could also be improved by excluding node_modules and generated coverage files.
>
> -- Mehrshad Ahdi | Jul 27 at 2:24am

Isn't that mainly the expection of the very final assignment, though? Because nearly all the other assignment that involved building out the project in chunks, and mainly is feature focus than anything. Besides silo-ing the development might be for the best as this class is async, and not every group can develop at the same time. I completed my section as the Canvas description vaguely say.

But overall, I have negative to epsilon amount of beef/peevishness with you, man. I actually get a feeling you seen our repo. Also, I like the detailedness of the feedback though.

##### Extra Extra Personal Note/Bio

For the record, at the time of this extra extra note, Summer 2026 would be third to last semester for me. I could graduate in the Fall 2026, but you know, Pell and TEXAS Grant money alongside some occasional scholarship (7K this upcoming semester) money; in addition, I have never taken any break between semesters since Fall 2023.

Furthermore, I'm currently and recently/officially double majoring in Computer Science and Mathematics (Data Science Option) with a minor in Biology -- more focus in General Biochemistry and soon to be Bioinformatics in Fall 2026.

Oh yeah, I had the Dr. Carlos Ordonez for COSC 3320 (Algos, and I got <strong>B minus</strong>) and COSC 3380 (DBMS, and I got a <strong>A</strong>), practically been to every lecture of his during those times and in the front, and here are my GPAs:

<ul>
    <li>COSC (Primary major) : 2.889</li>
    <li>MATH (Secondary major) : 3.240</li>
    <li>BIOL (Minor) : 3.142</li>
</ul>

In short, first generation college student, very early twenties, high functioning autistic, tech and life science polymath, a hint of the strictness/personality of Dr.Ordonez, and another hint of Tobey <strong>"Bully"</strong> Maguire Spider-Man from Spider-Man 3.
