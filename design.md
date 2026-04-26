Write a simple web app for the board game secret hitler. The website should be mobile compatible.

There should be:
1. An admin dashboard that only admin have access to
2. User interface where users should be able to vote yes or no, and observe the outcome of each election.

There shall be a way to track users. They dont need password. They should input a secret word defined in the website backend code, and be allowed to join. The admin can start the game whenever they want.

The flow of the game looks like this
1. User x, y and z input the secret word and register their name. This change shall be reflected in the admin panel with a view of all current users.
2. Admin starts the game. No more users are allowed to join. If they attempt, they will be blocked by a page.
3. The screen displays round 1. x, y, z can either vote yes or no. After they vote, they should be able to confirm their vote, to avoid misclick.
4. Admin should be able to see who has voted in the admin panel in real time. They should not, however, see what are the votes.
5. Once all users have voted, admin can finish the round.
6. On everyone's screen, the game state should change to reflect
    - how many people have voted yes and how many no. anonymous
    - if the result is pass or fail.
7. Everyone can press continue to continue the game to state 3.
8. In addition, admin should have a button (with confirmation) to reset and restart the game