# Learning curriculum

The curriculum is persisted and initially seeded by `supabase/migrations/0005_curriculum_seed.sql`. It contains six phases, 24 weeks and 83 topics. Migration 0016 protects phase/week/topic rows edited in the authenticated admin UI from being overwritten if the historical seed is rerun; migration 0017 fills empty prerequisite lists only on untouched seeded topics. Migration 0018 attaches a free reference to each published topic where no matching topic/resource URL already exists. It is additive and re-runnable, preserving administrator-added links. Migration 0028 appends phase-appropriate instructions, checks, and expected artifacts to a topic exercise only when its text still matches the original seed, preserving administrator-edited exercise text. Migrations 0016–0018 and 0028 remain pending disposable-project verification. Weeks store overview, objectives, deliverables and completion criteria; topics store description, objectives, prerequisites, estimated time, a practical exercise and completion criteria. Resources are separate rows.

`supabase/seed/weekly-assignments.sql` adds one draft assignment for each week that currently has no assignment. Run it only after the initial admin is active. The draft uses the week overview, deliverables, completion criteria, and topic resources. It skips any week with an existing assignment and does not alter submissions. Leaders/admins must review and publish drafts; publication then follows the normal notification and recipient rules. The seed has not been run against a database in this audit.

Weekly study time is derived from the sum of each week’s topic `estimated_minutes`, so the estimate is maintained in one place per topic rather than duplicated on the week row. The roadmap list and week detail page display that sum when at least one topic estimate is present. A static audit parsed all 83 topic seed rows: every topic has a positive estimate, and each of the 24 weeks has an aggregate between 4.5 and 8 hours. These are planning estimates, not tracked member learning time.

The six phases are Python fundamentals (weeks 1–4), mathematics and statistics (5–8), NumPy/Pandas/EDA (9–12), SQL and visualization (13–16), introductory machine learning (17–20), and capstone/portfolio (21–24). Authorized leaders/admins can edit curriculum content in the existing roadmap manager. Topic and week requirements are persisted and must be explicitly checked; this is learner self-report and must not be interpreted as independently verified mastery. The current schema does not model multiple reusable exercises per topic as separate records.

Official or free learning resource destinations used by the curriculum (verified on 2026-11-09):

- [Python tutorial](https://docs.python.org/3/tutorial/)
- [Python data structures](https://docs.python.org/3/tutorial/datastructures.html)
- [Python errors and exceptions](https://docs.python.org/3/tutorial/errors.html)
- [SciPy statistics tutorial](https://docs.scipy.org/doc/scipy/tutorial/stats.html)
- [NumPy Learn](https://numpy.org/learn/)
- [Pandas getting started](https://pandas.pydata.org/docs/getting_started/)
- [Pandas user guide](https://pandas.pydata.org/docs/user_guide/)
- [Matplotlib tutorials](https://matplotlib.org/stable/tutorials/)
- [Seaborn tutorial](https://seaborn.pydata.org/tutorial.html)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [PostgreSQL tutorial](https://www.postgresql.org/docs/current/tutorial.html)
- [SQLBolt](https://sqlbolt.com/)
- [Kaggle Learn](https://www.kaggle.com/learn)
- [scikit-learn getting started](https://scikit-learn.org/stable/getting_started.html)
- [scikit-learn linear models](https://scikit-learn.org/stable/modules/linear_model.html)
- [scikit-learn model evaluation](https://scikit-learn.org/stable/modules/model_evaluation.html)
- [scikit-learn user guide](https://scikit-learn.org/stable/user_guide.html)
- [Streamlit documentation](https://docs.streamlit.io/)
- [Git documentation](https://git-scm.com/doc)
- [GitHub Skills](https://skills.github.com/)

These destinations were opened during the 2026-11-09 audit. Kaggle's page returned no readable text to the browser tool, so link reachability was observed but content was not independently reviewed. References are selected by week and attached to each published topic in that week; learners should use the sections relevant to the topic, as not every official guide has a dedicated beginner lesson for every individual concept.
