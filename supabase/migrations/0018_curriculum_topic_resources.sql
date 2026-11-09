-- Attach existing verified free learning references across the curriculum.
-- Keep this additive: administrator-authored resources are never replaced.
-- Safe to re-run because each (topic, URL) pair is inserted only once.
do $resources$
declare
  v_team uuid := (select id from public.teams where slug = 'data-science-squad');
begin
  if v_team is null then
    raise exception 'Data Science Squad team must exist before curriculum resources are attached';
  end if;

  with week_resources(week_number, title, url, description, difficulty) as (
    values
      (1, 'Python Tutorial', 'https://docs.python.org/3/tutorial/', 'Official Python tutorial; use the sections relevant to this week’s topic.', 'beginner'),
      (2, 'Python Tutorial', 'https://docs.python.org/3/tutorial/', 'Official Python tutorial; use the sections relevant to this week’s topic.', 'beginner'),
      (3, 'Python Data Structures', 'https://docs.python.org/3/tutorial/datastructures.html', 'Official guide to Python lists, tuples, sets, and dictionaries.', 'beginner'),
      (4, 'Python Errors and Input/Output', 'https://docs.python.org/3/tutorial/errors.html', 'Official Python tutorial covering exceptions; follow the tutorial navigation for files and modules.', 'beginner'),
      (5, 'SciPy Statistics Tutorial', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html', 'Free documentation introducing statistical concepts and methods; some examples use SciPy.', 'beginner'),
      (6, 'SciPy Statistics Tutorial', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html', 'Free documentation introducing descriptive statistics and statistical methods.', 'beginner'),
      (7, 'SciPy Statistics Tutorial', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html', 'Free documentation covering probability distributions and random variables.', 'beginner'),
      (8, 'SciPy Statistics Tutorial', 'https://docs.scipy.org/doc/scipy/tutorial/stats.html', 'Free documentation covering sample statistics, tests, and resampling methods.', 'intermediate'),
      (9, 'NumPy Learn', 'https://numpy.org/learn/', 'Official NumPy learning hub for arrays and numerical computing.', 'beginner'),
      (10, 'Pandas Getting Started', 'https://pandas.pydata.org/docs/getting_started/', 'Official Pandas introduction to Series, DataFrames, and data IO.', 'beginner'),
      (11, 'Pandas User Guide', 'https://pandas.pydata.org/docs/user_guide/', 'Official guide to missing data, grouping, combining, and transforming data.', 'intermediate'),
      (12, 'Kaggle Learn', 'https://www.kaggle.com/learn', 'Free short courses for practicing data analysis and visualization.', 'intermediate'),
      (13, 'PostgreSQL Tutorial', 'https://www.postgresql.org/docs/current/tutorial.html', 'Official PostgreSQL tutorial introducing relational concepts and SQL.', 'beginner'),
      (14, 'SQLBolt', 'https://sqlbolt.com/', 'Free interactive SQL lessons covering querying, aggregation, and joins.', 'intermediate'),
      (15, 'Matplotlib Tutorials', 'https://matplotlib.org/stable/tutorials/', 'Official Matplotlib tutorials for figures, axes, and chart types.', 'beginner'),
      (16, 'Streamlit Documentation', 'https://docs.streamlit.io/', 'Official documentation for building interactive Python data apps.', 'intermediate'),
      (17, 'scikit-learn Getting Started', 'https://scikit-learn.org/stable/getting_started.html', 'Official overview of estimators, preprocessing, pipelines, and evaluation.', 'beginner'),
      (18, 'scikit-learn Linear Models', 'https://scikit-learn.org/stable/modules/linear_model.html', 'Official guide to linear regression and related linear models.', 'intermediate'),
      (19, 'scikit-learn Model Evaluation', 'https://scikit-learn.org/stable/modules/model_evaluation.html', 'Official guide to classification metrics and model evaluation.', 'intermediate'),
      (20, 'scikit-learn User Guide', 'https://scikit-learn.org/stable/user_guide.html', 'Official guide to clustering, dimensionality reduction, validation, and model selection.', 'intermediate'),
      (21, 'Git Documentation', 'https://git-scm.com/doc', 'Official Git documentation and book for version control workflows.', 'beginner'),
      (22, 'Pandas Getting Started', 'https://pandas.pydata.org/docs/getting_started/', 'Official Pandas guide for preparing and analyzing project datasets.', 'intermediate'),
      (23, 'scikit-learn Getting Started', 'https://scikit-learn.org/stable/getting_started.html', 'Official guide to training, evaluating, and applying scikit-learn models.', 'intermediate'),
      (24, 'GitHub Skills', 'https://skills.github.com/', 'Free interactive lessons for GitHub workflows, documentation, and collaboration.', 'beginner')
  ), topic_resources as (
    select t.id as topic_id, wr.title, wr.url, wr.description, wr.difficulty,
           row_number() over (partition by t.week_id order by t.display_order, t.id) as topic_order
    from public.topics t
    join public.weeks w on w.id = t.week_id and w.team_id = t.team_id
    join week_resources wr on wr.week_number = w.week_number
    where t.team_id = v_team
      and t.publication_status = 'published'
      and w.status = 'published'
  )
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team, tr.topic_id, tr.title, tr.url, 'documentation', tr.description,
         tr.difficulty::public.topic_difficulty, true, 10 + tr.topic_order
  from topic_resources tr
  where not exists (
    select 1 from public.learning_resources existing
    where existing.team_id = v_team
      and existing.topic_id = tr.topic_id
      and existing.url = tr.url
  );
end
$resources$;
