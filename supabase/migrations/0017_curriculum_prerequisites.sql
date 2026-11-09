-- Fill the curriculum's existing prerequisite field with week-level guidance.
-- Only untouched, empty seeded topics are modified: administrator-authored
-- prerequisite arrays and other edited topic rows remain intact.
update public.topics t
set prerequisites = jsonb_build_array(case w.week_number
  when 2 then 'Week 1: Python syntax, variables, data types, input/output, and operators.'
  when 3 then 'Weeks 1–2: Python variables, conditions, loops, and iteration.'
  when 4 then 'Weeks 1–3: Python data structures, loops, and basic problem solving.'
  when 5 then 'Basic arithmetic, fractions, percentages, and ratios.'
  when 6 then 'Week 5: number systems, percentages, ratios, algebra, and functions.'
  when 7 then 'Week 6: mean, median, variation, distributions, and reading data summaries.'
  when 8 then 'Weeks 6–7: descriptive statistics and introductory probability.'
  when 9 then 'Python fundamentals and basic arithmetic; vectors and matrices are introduced in this week.'
  when 10 then 'Week 9: NumPy arrays, indexing, and vectorized operations.'
  when 11 then 'Weeks 9–10: Python collections, NumPy arrays, and DataFrame basics.'
  when 12 then 'Weeks 10–11: loading, selecting, filtering, and summarizing tabular data.'
  when 13 then 'Weeks 10–12: relational data concepts and exploratory data analysis.'
  when 14 then 'Week 13: SELECT, filtering, sorting, aggregation, and basic joins.'
  when 15 then 'Basic descriptive statistics and choosing a chart for a data question.'
  when 16 then 'Week 15: Matplotlib/Seaborn charts and foundational visualization principles.'
  when 17 then 'Python, basic statistics, pandas data handling, and exploratory analysis.'
  when 18 then 'Week 17: features, labels, train/test splits, preprocessing, and scikit-learn basics.'
  when 19 then 'Weeks 17–18: supervised learning, regression, train/test evaluation, and model metrics.'
  when 20 then 'Weeks 17–19: supervised learning, regression/classification metrics, and prepared datasets.'
  when 21 then 'Git basics, exploratory data analysis, and identifying a tractable analytical question.'
  when 22 then 'Week 21: an approved project proposal, data source, and version-controlled repository.'
  when 23 then 'Week 22: a cleaned dataset, completed exploratory analysis, and project objectives.'
  when 24 then 'Weeks 22–23: a working and evaluated project, documentation, and interpretable results.'
end)
from public.weeks w
where w.id = t.week_id
  and w.week_number between 2 and 24
  and t.prerequisites = '[]'::jsonb
  and t.updated_at = t.created_at;
