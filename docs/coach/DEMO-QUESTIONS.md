# ReqLens Coach — Demo questions

Each link opens the live Coach and asks the question. Results are from the latest evaluation
([eval/results/latest.md](../../eval/results/latest.md)); answers vary slightly between runs.

## Especially good

1. **[Why does Cohn recommend numbering story cards?](https://reqlensai.com/coach?q=Why%20does%20Cohn%20recommend%20numbering%20story%20cards%3F)**
   False premise. It corrects it and quotes the notes: "Do not number the cards. Numbers add
   overhead and make discussion abstract." (p. 9). This only worked after adding keyword search
   to the vector search and raising top-K from 6 to 8.
2. **[Does the Daily Scrum still use the three questions?](https://reqlensai.com/coach?q=Does%20the%20Daily%20Scrum%20still%20use%20the%20three%20questions%3F)**
   The sources disagree. It answers from the 2020 Scrum Guide (p. 10: the Developers choose any
   structure) and attributes the three questions to the older accounts in the study notes.
3. **[Our team of four developers runs two-week iterations. Roughly how many iterations would a 120-point release take?](https://reqlensai.com/coach?q=Our%20team%20of%20four%20developers%20runs%20two-week%20iterations.%20Roughly%20how%20many%20iterations%20would%20a%20120-point%20release%20take%3F)**
   Multi-step. It applies the notes' rule of thumb (velocity a third to a half of
   developer-days) and lands on about 6 to 9 iterations, citing Ch. 9.
4. **[When should a team use Kanban instead of Scrum?](https://reqlensai.com/coach?q=When%20should%20a%20team%20use%20Kanban%20instead%20of%20Scrum%3F)**
   Draws on the Agile Methods notes' comparison: Kanban for continuous, unpredictable flows
   of small items; Scrum when work can be planned toward a goal in fixed cycles.
5. **[How do I set up user stories in Jira?](https://reqlensai.com/coach?q=How%20do%20I%20set%20up%20user%20stories%20in%20Jira%3F)**
   Out of scope. It says the documents don't explain how to configure Jira, mentions the one
   place Jira is named, and doesn't make up set-up steps.
6. **[Qu'est-ce qu'une user story ?](https://reqlensai.com/coach?q=Qu%27est-ce%20qu%27une%20user%20story%20%3F)**
   French question over English documents. It answers in French, citing Ch. 1.

## Weak, and why

7. **[Who has the final say on priorities, the developers or the customer?](https://reqlensai.com/coach?q=Who%20has%20the%20final%20say%20on%20priorities%2C%20the%20developers%20or%20the%20customer%3F)**
   It answers "the Product Owner" from the Scrum Guide and misses the notes' Ch. 9 line, "the
   customer wins. Every time." The two sources frame this differently, and the bot does not
   surface the disagreement.
8. **[How does the AltexSoft whitepaper's description of Scrum differ from the 2020 Scrum Guide?](https://reqlensai.com/coach?q=How%20does%20the%20AltexSoft%20whitepaper%27s%20description%20of%20Scrum%20differ%20from%20the%202020%20Scrum%20Guide%3F)**
   The answer exists as a table in the Agile Methods notes (Part D2), but the table is split
   across two chunks and the second half has no heading, so some runs miss it, and one run
   wrongly claimed the notes gave no figures.
9. **[Summarise the whole book chapter by chapter.](https://reqlensai.com/coach?q=Summarise%20the%20whole%20book%20chapter%20by%20chapter.)**
   Retrieval returns a handful of passages per search, so it covers most chapters, names the
   ones it is missing, and says the outline is incomplete. Honest, but not what was asked.
10. **[Which chapters mention velocity, and how many times?](https://reqlensai.com/coach?q=Which%20chapters%20mention%20velocity%2C%20and%20how%20many%20times%3F)**
    Counting across a whole document is not something chunk retrieval can do. It lists where
    it saw the term and says it cannot give an exact total.
