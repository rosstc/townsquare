# Release Notes
### Ideas
- Add a set of emotes that come from a players seated position
-- probably disable emotes during an active votes/other important activites

### Version 3.1.2
- Add a quick re-rack button.
- Include the 2 known One Night Ultimate Clocktower scripts into the scripts menu:
-- One_Night_Ultimate_Carl_Extreme.json
-- One_Night_Ultimate_Carl_5_2_4.json
- Fixed the "Night Order" menu item not showing a tick when on.
- Re-organised the menu's
- 

### Version 3.1.1
- Added robust scoring system for One Night Ultimate Clocktower.

### Version 3.1.0
- Added "One Night Ultimate Clocktower"
- https://www.botcscripts.com/script/1254/5.2.4
- Script & ruleset by Ken Cheng, version 5.2.4

### Version 3.0.3
- gong overlap higher on z axis, over reminders
- vote icon over the shroud icon
- vote history; add a line under each night
- Add Trouble With Violets to the list of scripts

### Version 3.0.2
- Added Fabled & Bluffs to the Victory reveal screen.
- Minor fix to the point vote sync feature.
- Revised reveal logic and add cliff-hanger paired reveal.
- Added dramatic pair-reveals when applicable.
- Added a visual affect when Evil players are revealed.
- Added some tools to quickly start a dev session.

### Version 3.0.1
- Added reveal for the true character tokens, such as Drunk, Marionette, etc.
- Removed the Exit Presentation button and other minor fixes.
- Added a special Good win reveal, so the dead Demon is revealed second to last.

### Version 3.0.0
- Added a Storyteller Victory reveal screen & grimoire reveal!
- Victory Screen System — Full Implementation

-- Delivers a complete end-to-end victory flow using authentic grimoire
-- visuals and a structured ST workflow.

- ST workflow:
-- ST declares victory → celebration plays for everyone; ST joins the town
-- ST dismisses → returned to Victory Modal to review/adjust alignments and select winners
-- ST clicks Reveal Grimoire → synchronized reveal plays for all clients simultaneously
-- Any client can dismiss their own reveal screen independently

### Version 2.25.2
- Added a button for the Storyteller and players to toggle the alignment of players.

- Good/Evil Alignment Toggle (new feature)
-- Seated players and the Storyteller can now privately annotate player alignment during a game.

- Storyteller view
-- A small circle button appears on each player token (top-right, matching the Night Order circle sizing and responsive scaling).
-- Clicking cycles alignment: Townsfolk/Outsider toggle evil → null; Minion/Demon toggle good → null; Traveler cycles good → evil → null.
-- A colour overlay (mix-blend-mode: color) tints the token blue (good) or red (evil).
-- ST alignment state is stored in Vuex and not transmitted via socket.

- Seated player view
-- Alignment buttons are visible on all player tokens — clicking records a private, local-only annotation for that token.
-- Annotations are stored in localStorage keyed by localAlignment_{playerId}_{targetPlayerId} — never transmitted through the socket.
-- Own token button is always visible; other tokens' buttons appear only when annotated (good/evil set), or on hover when neutral.
-- When a seated player has annotated their own token, the radiant pulsing glow behind their character token overrides the team colour: good → townsfolk blue, evil → demon red.

- Raise-hand button
-- The clickable raise-hand circle is hidden for seated players on other players' tokens.
-- The raised-hand image itself remains visible across all clients when a player raises their hand.
-- The ST can still click the button on behalf of any player.

- Build / Cross-platform Fix
-- Added cross-env devDependency so NODE_OPTIONS=--openssl-legacy-provider works on Windows without NODE_OPTIONS syntax errors.

- Bug Fixes:
-- String.substr() → String.slice() (deprecation) in socket.js.
-- Night Order circles and raise-hand emote raised to z-index: 5 to render above the alignment colour overlay.
-- Player context menu z-index: 50 — no longer drops behind other player tokens on hover.
-- TownSquare.vue emote em raised to z-index: 5.
-- Alignment button responsive sizing added to media.scss at <1200px and <992px breakpoints, matching the Night Order circle dimensions exactly.

### Version 2.25.1
- Fixed: When you toggle to "Show" mode [G], a seated player could not point-vote.
- Set NODE_OPTIONS within packahe.json instead of manually for local builds.

### Version 2.25.2
- New Feature — Seasonal Events System:
-- A single-file toggle system for seasonal themes (e.g. Christmas). Changing one line in src/events.js switches the active event; no other files need editing.
-- To add a future event: add an entry to configs in events.js, place assets in the appropriate subfolder, add a CSS block in App.vue for any new visual overlay, then set ACTIVE_EVENT.
- Bug Fixes:
- Fixed a rare TypeError whenever a player was removed during an active Point Vote
- Deprecated substr replaced with slice
- Fixed idle tab/browser sessions by sending a keepalive message & response ping
- Better organisd session and grimoire settings
- Safeguard against too many point-vote clicks being made in that mode
- Fixed a delay in the point-vote highlighting as you progress clockwise around the townsquare

### Version 2.25.1
- Added the Point Vote feature to the Townsquare.
- Minor fix for lagging character tooltips
- Added minor fix for the vote history toggling back on

### Version 2.25.0
- Removed the Christmas themed gong, snowy backdrop.
- Added a vertical scroll bar to the character selection and assignment modals

### Version 2.24.2
- Very minor character text changes for "A Very Merry Clocktower Christmas"
- Added a Wassailer as a "fabled" character, just to remind the Story Teller to do this

### Version 2.24.1
- Added the final florishes to the Christmas themed Townsquare:
- Updated gong, night animation and background

### Version 2.24.0
- Added the full homebrew script of "A Very Merry Clocktower Christmas"
- https://chillclocktower.com/homebrew/merrryclocktower/almanac/#synopsis

### Version 2.23.1
- Added the Big Wig (Loric)
- Added the Tor (Loric)
- Minor Loric label added

### Version 2.23
- Added new & randomised backgrounds
- Added Hermit (Outsider)
- Added Deus ex Fiasco (Fabled)
- Added Princess (Townsfolk)
- Added Wraith (Minion)

### Version 2.22.2
- Harpy (Minion), Ability - "Each night, choose 2 players: tomorrow, the 1st player is mad that the 2nd is evil, or one or both might die."
- Balloonist (Townsfolk), Ability - "Each night, you learn a player of a different character type than last night. [+0 or +1 Outsider]"
- Added Storyteller reminder into the Lycanthrope ability; a Demon still wakes and chooses if applicable, but they don't cause a death if they normally would.
- Added Storyteller reminder to the Legion night sheet - "Most nights, kill a Legion. Your aim is to get to three players; two good players and one Legion player. On the final day, if the players don't execute, kill a good player that night so that evil wins."

### Version 2.22.1
- Updated Riot (Demon)
-- Ability was: "Nominees die, but may nominate again immediately (on day 3, they must). After day 3, evil wins. [All Minions are Riot]"
-- Ability is:  "On day 3, Minions become Riot & nominees die but nominate an alive player immediately. This must happen."

- Updated Organ Grinder (Minion)
-- Ability was: "All players keep their eyes closed when voting & the vote tally is secret. Votes for you only count if you vote."
-- Ability is:  "All players keep their eyes closed when voting & the vote tally is secret. Each night, choose if you are drunk until dusk or not."

- Updated Lycanthrope (Townsfolk)
-- Ability was: "Each night*, choose an alive player: If good, they die & the Demon doesn't kill tonight."
-- Ability is: "Each night*, choose an alive player: If good, they die & the Demon doesn't kill tonight. One good player registers as evil."

### Version 2.22
- Added Boffin (Minion)
- Added Xaan (Minion)
- Added Wizard (Minion)
- Added Trapezist (Townsfolk) - This is the revised Acrobat from the UBOTCT Discord.
- Added Gnome (Traveller)
- Added Bootlegger (Fabled)
- Added Ferryman (Fabled)
- Added Gardener (Fabled)

### Version 2.21
- Added Zealot (Outsider)
- Added Lord of Typhon (Demon)
- Minor: accept formatting from updated npm compile (EditionModal).

### Version 2.20.1
- Added new Jinx for the Summoner/Pukka not in Discord, but in the official script tool.

### Version 2.20
- Added Banshee (Townsfolk)
- Added Ogre (Outsider)
- Added Alsaahir (Townsfolk)

### Version 2.19
- Added Yaggababble Demon
- Added Summoner Minion
- Updated Jinxs
- Minor adjustments to Kazali icon.

### Version 2.18.2
- Added the 'Kazali' (Demon) and 'Village Idiot' (Townsfolk) characters, icons and jinxes.

### Version 2.18.1
- Added 'Hatter' character, icon and jinxes.

### Version 2.18
- fixed custom script format to support new script tool JSON
- Added jinx's for the Ojo
- Added simple reminders for the Riot
- Gong sound - added a pre-load statment to the first use of the sound sync's with the animation
- Updated the custom script list & basic instructions about the github gist.

### Version 2.17.5
 - Added the 'Ojo' Demon.
 - Adjusted the voting countdown volume.

### Version 2.17.4.1
 - Added a 'Return to Townsquare' menu item for the Story Teller
 - Reduced the volume of the countdown audio
 - Added the new townsfolk, 'Shugenja'
 - Moved all Fall of Rome characters to the end of the roles file
 - Fixed Chambermaid/Mathematician -  they are second & last to act on first night, respectively.

### Version 2.17.3
- added missing Jinx rules for: Bounty Hunter, Organ Grinder, Vizier, Plague Doctor
- updated "Hand Raised" icon, position and z priority
- added feature to put all emote hands down at the start of each night

### Version 2.17.2
- added player "Hand Raise" emote
- minor fixes to the Hidden Voting connect/reconnect game state 

### Version 2.17.1
- added the High Priestess (Townsfolk)
- added the Harpy (Minion)
- added the Plague Doctor (Outsider)
- updated the custom script list

### Version 2.17.0
- Fall of Rome (Homebrew):
-- added entire home brew script by Alex S
-- Fall of Rome character night order is independent of the core/experimental scripts for the moment.

### Version 2.16.4
- added the Knight (Townsfolk) & Steward (Townsfolk)

### Version 2.16.3
- added the Vizier character (minion)

### Version 2.16.2
- added the Organ Grinder character (minion)
- added support for Hidden Voting as a grimoire gamestate (by @LukeC82)
- amended the custom script list (hosted at https://gist.github.com/LukeC82)
- jinx and character changes for the Lleech

---

### Version 2.16.1
- Updated character night order to be consistent with script tool

---

### Version 2.16.0
- Add ability to use json from clipboard to upload script (by @alexanderfletcher)

---

### Version 2.15.4
- fixed flickering of add reminder token
- added redirect to Chinese version

---

### Version 2.15.3
- add Huntsman/Damsel, Noble, Al-Hadikhia, Golem, Fearmonger, Puzzlemaster, Alchemist, Engineer, Riot, Psychopath, Atheist, Nightwatchman to list of available characters
- fixed game state JSON not handling custom Fabled correctly

---

### Version 2.15.2
- added mobile web application support
- show correct number of leaves on roles with global reminders
- fixed a bug with traveler list showing up when assigning demon bluffs
- fixed a bug with homebrew scripts that contained negative night order positions

---

### Version 2.15.1
- fix Mephit not showing up on scripts, futureproof Mephit name change
- add Boomdandy to list of available characters

---

### Version 2.15.0
- clean up transparent portions of icons
- add Magician & LLeech to list of available characters

---

### Version 2.14.0
- added Farmer to list of available characters

---

### Version 2.13.0
- fix players being moved or removed during nomination
- add vue linter
- use "Exile" rather than "Banishment" for exiles
- added global animation toggle for better performance
- added record vote history toggle to session menu, and clear vote history button
- add support for custom Fabled characters
- show Jinxed interactions on character reference list
- add 'marked for execution' indicator

---

### Version 2.12.0
- tweak reference sheet to better fit screen in single column layout
- add warning icon overlay for setup roles on character assignment modal
- added Heretic and Marionette plus King/Choirboy and the Gangster to list of available characters

---

### Version 2.11.0
- new design for character reference sheet
- automatically switch to grimoire view when joining a session through a link
- fixed demon bluffs showing on public town square
- fixed a bug that prevented connecting to a session when previously being connected and joining through a link

---

### Version 2.10.0
- added [nomination log indicator](https://fontawesome.com/icons/book-dead).  When a nomination log [v] is available, the number of currently visible entries is displayed. Clicking the indicator can reveal/hide the nomination log.
- fix issue where a player and storyteller updating the same players pronouns at around the same time causes an infinite loop disconnecting the session.
- fix bug with shifting roles when the storyteller deletes a player
- added Poppygrower to list of available characters

---

### Version 2.9.1
- fix gamestate JSON not showing (custom) roles and failing to load states with custom scripts properly
- fix gamestate not stripping out special characters from role.id on load
- made character assignment modal a bit prettier
- got rid of the extra pixels on the  Soldier icon
- fixed lengthy live session channel names not being correctly cut off
- hide player names in night order / character reference popup when town square is public
- fix (pre-)vote calculation being off by one if the nominee votes

---

### Version 2.9.0
- added support for assigning pronouns to players and display of the pronouns in a tooltip on the player name.
- added button to modals that allows the user to maximize them
- added Mephit and Snitch to roles.json

---

### Version 2.8.0
- added hands-off live session support for homebrew / custom characters again!
- added custom image opt-in that will prevent any (potentially malicious / harmful) images from loading until a player manually allows them to

---

## Version 2.7.0
- added support for assigning duplicate characters to more than one player (like Legion)
- further live session bandwidth optimizations
- sessions can now be joined by pasting the whole link into the popup (thanks @davotronic5000)
- fabled night order bug fixed
- added Legion to list of available characters (thanks @eddgabriel)
- added support for mp4/webm video backgrounds
- added tooltips to night order popup

---

## Version 2.6.0
- night mode can be toggeled with [S] now (thanks @davotronic5000)
- night order shows which players are dead

---

## Version 2.5.0
- all travelers from the base editions are now optionally available (thanks @davotronic5000)
- night order shows player names near roles now

---

## Version 2.4.0
- added spoiler role (Pixie!)
- fixed bug with ST sending out roles that are not part of the current edition / script (ie. travelers or base set roles)
- better Lycanthrope icon (thanks @AWConant)

---

## Version 2.3.1
- better vote history design and added timestamps
- adjusted player menu styling on smaller screens
- improved CONTRIBUTING.md description of hosting your own copy

---

## Version 2.3.0
- added spoiler role (Lycanthrope!)
- fixed copy to clipboard in Firefox
- fixed non-countdown votes still playing countdown sound for a split second

---

## Version 2.2.1
- clearing players / roles now also clears Fabled
- fix list of locked votes showing unlocked votes sometimes

---

## Version 2.2.0
- added [V] hotkey to open nomination history (thanks @lilserf)
- updated roles according to official Wiki changes
- adjusted roles night order

---

## Version 2.1.1
- show vote results at the end of a vote
- fixed global reminders not showing up anymore when the associated role is assigned to a player
- adjusted backend metrics


---

## Version 2.1.0
- reduced countdown volume by 10db
- added a mute toggle to the Grimoire menu (currently only silences the countdown)
- pressing [J] while in a session will now leave the session
- always show reminder add button when on a mobile device that doesn't support hovering
- removed screenshot feature as it is no longer useful

---

## Version 2.0.4
- fix bug with live sessions that contain travelers from a different set
- fix server channel cleanup

---

## Version 2.0.3
- load roles that belong to different editions (like travelers) from gamestate
- close session when missing custom roles and open edition modal
- added a few more metrics

---

## Version 2.0.2
- fix nomination history type not detecting travelers
- fix live session domain whitelist
- fix build path
- fix changelog version numbering

---

## Version 2.0.1
- clearing the nomination history as the Storyteller clears it for the players too
- vote buttons should work in all situations correctly now
- fixed some minor styling and live session issues

---

## Version 2.0.0
- The project is now available under its own domain: [clocktower.online](https://clocktower.online)
- Added a feature that allows a live session Storyteller to automatically (and safely) distribute assigned
  characters to all players that have claimed a seat, eliminating the need to manually tell every player their role
- Visible "night phase" that can be toggled by the Storyteller
- Voting history added with nomination and vote results
- Optional, audible voting countdown added (featuring an actual clock tower bell!)
- Fabled show up on the Night Order sheet and affect Grimoire night order counters
- Current game state can now be easily exported and imported in the form of a JSON text code
- Voting can be paused and sped up / slowed down in 0.5 second increments by the Storyteller
- Voting terminology changed to "Hand UP" / "Hand DOWN" and iconography updated
- Added meta-data support for custom scripts, that currently supports `name`, `author` and a custom `logo` through a
  `_meta` role (note that a customized logo will not be synced to players in a live session)
- Players can no longer claim seats that are already occupied and only the Storyteller can vacate seats of other players
  (players can still vacate their own seat)
- Characters selected in the bluff window now also show up in the list of reminder tokens
- Homebrew scripts / custom characters no longer automatically load in live sessions, for 2 reasons:
  - the players in a live session have no control over the script that the storyteller loads,
    so a malicious storyteller could load a custom script that contains harmful / inappropriate images
  - some homebrew scripts are quite big JSON files and synching these through the live session
    server can cause traffic / performance issue easily
  - this change may be reverted in the future when I figure out a way to sync custom characters safely and without
    such a big impact on performance constraints
- Buggy (spamming) live session connections will now be terminated on the server side and display an error message
- Balloonist reminder tokens adjusted
- Live session URLs shortened
- Deus Ex Fiasco and Stormcatcher Fabled added / updated
- Custom Reminder text looks better when there is a lot of text
- added a README for the backend server
