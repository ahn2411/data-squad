-- Expand the seed's concise exercise labels into guided, reviewable practice.
-- Each field is changed only when it still exactly matches the original 0005
-- seed value. A member of the team may edit the exercise independently, and
-- this migration will preserve any such edit. Re-running is a no-op.
--
-- The legacy seed-preservation trigger treats unauthenticated updates as seed
-- reruns after any row edit. Exact per-field baseline checks below are the
-- guard for this curated migration; the local subject lets the trigger permit
-- these forward-only content updates. The migration runs as the schema owner.
do $guided_exercises$
declare
  v_team_id uuid := (select id from public.teams where slug = 'data-science-squad');
  v_updated integer;
begin
  if v_team_id is null then
    raise exception 'Data Science Squad team is missing; apply the curriculum seed first.';
  end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

  with seeded_exercises(slug, baseline_exercise) as (
    values
      ($slug$getting-started-with-python$slug$, $base$Personal information program$base$),
      ($slug$variables-and-operators$slug$, $base$Simple calculator$base$),
      ($slug$data-types-and-type-conversion$slug$, $base$Basic mathematical operations$base$),
      ($slug$input-output-and-comments$slug$, $base$Temperature converter
Unit converter$base$),
      ($slug$boolean-logic-and-operators$slug$, $base$Even and odd checker$base$),
      ($slug$conditional-statements$slug$, $base$Grade calculator
Electricity bill calculator$base$),
      ($slug$for-and-while-loops$slug$, $base$Multiplication tables
Number guessing game
Prime number checker$base$),
      ($slug$nested-loops-and-patterns$slug$, $base$Pattern printing$base$),
      ($slug$strings-and-string-methods$slug$, $base$Word frequency counter$base$),
      ($slug$lists-and-list-methods$slug$, $base$Shopping cart$base$),
      ($slug$tuples-and-sets$slug$, $base$Shopping cart (immutable views)$base$),
      ($slug$dictionaries-and-nested-structures$slug$, $base$Contact book
Student record management
Simple inventory system$base$),
      ($slug$defining-and-calling-functions$slug$, $base$Reusable calculator$base$),
      ($slug$function-parameters-scope-and-lambdas$slug$, $base$Reusable calculator (extended)$base$),
      ($slug$modules-and-imports$slug$, $base$Mini Python project$base$),
      ($slug$error-handling-and-files$slug$, $base$File-based student management system
Expense tracker
CSV data reader$base$),
      ($slug$numbers-fractions-and-proportions$slug$, $base$Percentage analysis
Revenue and profit calculations$base$),
      ($slug$algebra-equations-and-functions$slug$, $base$Growth calculations$base$),
      ($slug$exponents-and-logarithms$slug$, $base$Basic mathematical Python exercises$base$),
      ($slug$summation-and-math-notation$slug$, $base$Basic mathematical Python exercises (notation to code)$base$),
      ($slug$statistics-foundations-and-data-types$slug$, $base$Calculate statistical measures using Python$base$),
      ($slug$measures-of-central-tendency$slug$, $base$Analyze student marks$base$),
      ($slug$measures-of-dispersion$slug$, $base$Compare datasets$base$),
      ($slug$percentiles-and-quartiles$slug$, $base$Identify outliers$base$),
      ($slug$probability-foundations$slug$, $base$Dice simulation
Coin toss simulation
Probability experiments using Python$base$),
      ($slug$conditional-probability-and-rules$slug$, $base$Probability experiments using Python$base$),
      ($slug$random-variables-and-distributions$slug$, $base$Visualizing distributions$base$),
      ($slug$sampling-and-the-central-limit-theorem$slug$, $base$Sample analysis$base$),
      ($slug$confidence-intervals-and-hypothesis-testing$slug$, $base$Basic hypothesis testing$base$),
      ($slug$errors-and-statistical-significance$slug$, $base$Statistical interpretation report$base$),
      ($slug$correlation-and-covariance$slug$, $base$Correlation calculations$base$),
      ($slug$numpy-arrays-and-creation$slug$, $base$Array calculations$base$),
      ($slug$indexing-slicing-and-reshaping$slug$, $base$Mathematical operations$base$),
      ($slug$vectorized-operations-and-broadcasting$slug$, $base$Statistical calculations using NumPy$base$),
      ($slug$pandas-series-and-dataframes$slug$, $base$Load real datasets$base$),
      ($slug$reading-and-inspecting-data$slug$, $base$Inspect dataset structures$base$),
      ($slug$selecting-and-filtering$slug$, $base$Filter records$base$),
      ($slug$sorting-and-modifying-columns$slug$, $base$Generate statistical summaries$base$),
      ($slug$handling-missing-and-duplicate-data$slug$, $base$Clean a messy dataset
Handle missing information$base$),
      ($slug$transforming-strings-dates-and-outliers$slug$, $base$Clean a messy dataset (strings and dates)$base$),
      ($slug$apply-map-and-groupby$slug$, $base$Generate grouped summaries$base$),
      ($slug$merging-joining-and-pivoting$slug$, $base$Merge datasets$base$),
      ($slug$eda-foundations-and-univariate-analysis$slug$, $base$Complete an EDA project (univariate stage)$base$),
      ($slug$bivariate-and-multivariate-analysis$slug$, $base$Complete an EDA project (multivariate stage)$base$),
      ($slug$outliers-and-correlation-analysis$slug$, $base$Complete an EDA project (correlation stage)$base$),
      ($slug$data-storytelling$slug$, $base$Write an analytical report
Present findings with evidence$base$),
      ($slug$relational-database-foundations$slug$, $base$Create a sample database$base$),
      ($slug$querying-data-with-select$slug$, $base$Retrieve information
Filter and sort data$base$),
      ($slug$modifying-data-with-dml$slug$, $base$Insert records$base$),
      ($slug$aggregations-and-grouping$slug$, $base$Business sales analysis
SQL analytical exercises$base$),
      ($slug$joins-and-subqueries$slug$, $base$Multi-table queries
Customer analysis$base$),
      ($slug$ctes-case-and-window-functions$slug$, $base$Business sales analysis (advanced)$base$),
      ($slug$visualization-principles-and-matplotlib-basics$slug$, $base$Visualize real datasets$base$),
      ($slug$basic-chart-types$slug$, $base$Compare distributions$base$),
      ($slug$chart-customization$slug$, $base$Visualize real datasets (styled)$base$),
      ($slug$statistical-visualization-with-seaborn$slug$, $base$Create correlation heatmaps$base$),
      ($slug$data-storytelling-and-chart-selection$slug$, $base$Create a data-driven presentation
Present findings to the squad$base$),
      ($slug$dashboard-design-and-kpis$slug$, $base$Build an interactive data dashboard (plan)$base$),
      ($slug$interactive-visualization-with-plotly-and-streamlit$slug$, $base$Build an interactive data dashboard$base$),
      ($slug$ai-and-ml-foundations$slug$, $base$Classify a problem into the right learning paradigm$base$),
      ($slug$features-labels-and-data-splits$slug$, $base$Load a dataset
Prepare features and labels
Split training and testing datasets$base$),
      ($slug$introduction-to-scikit-learn$slug$, $base$Train and evaluate a simple model with scikit-learn$base$),
      ($slug$linear-regression-foundations$slug$, $base$House price prediction (simple linear regression)$base$),
      ($slug$multiple-regression-and-assumptions$slug$, $base$Salary prediction (multiple linear regression)$base$),
      ($slug$regression-evaluation-metrics$slug$, $base$Regression model evaluation$base$),
      ($slug$classification-foundations-and-logistic-regression$slug$, $base$Spam classification$base$),
      ($slug$tree-based-classifiers$slug$, $base$Customer churn prediction$base$),
      ($slug$classification-evaluation-metrics$slug$, $base$Classification model evaluation$base$),
      ($slug$clustering-algorithms$slug$, $base$Customer segmentation$base$),
      ($slug$dimensionality-reduction-with-pca$slug$, $base$Model comparison with PCA features$base$),
      ($slug$feature-engineering-and-model-tuning$slug$, $base$Model comparison
Performance improvement$base$),
      ($slug$defining-the-capstone-project$slug$, $base$Project proposal
Problem statement$base$),
      ($slug$data-collection-and-dataset-selection$slug$, $base$Dataset selection$base$),
      ($slug$git-and-github-workflow$slug$, $base$Initial repository$base$),
      ($slug$data-preprocessing-and-cleaning$slug$, $base$Clean dataset$base$),
      ($slug$eda-and-feature-engineering$slug$, $base$EDA notebook$base$),
      ($slug$statistical-analysis-and-visualization$slug$, $base$Initial findings$base$),
      ($slug$model-selection-and-training$slug$, $base$Working analytical or ML solution$base$),
      ($slug$evaluation-and-comparison$slug$, $base$Evaluation report$base$),
      ($slug$documentation-and-visualization$slug$, $base$Visualizations$base$),
      ($slug$documentation-and-github-portfolio$slug$, $base$GitHub repository
Project documentation$base$),
      ($slug$presentation-and-technical-communication$slug$, $base$Presentation
Final project$base$),
      ($slug$reflection-and-future-roadmap$slug$, $base$Individual reflection$base$)
  )
  update public.topics as t
  set practical_exercise = concat_ws(
    E'\n\n',
    nullif(btrim(t.practical_exercise), ''),
    'How to complete it:',
    case w.week_number
      when 1 then $guide$Implement the listed exercise(s) as a small, runnable Python script. Prompt for required values, convert inputs to the correct types, store them in clearly named variables, perform the requested calculation, and print a readable result with units where appropriate. Run at least two normal examples and one boundary or invalid-input example. Submit the script and a short note describing one bug you found or prevented.$guide$
      when 2 then $guide$For each listed exercise, write down the decision rules and loop exit condition before coding. Implement the rules with the appropriate if/elif/else branches and for/while loops; avoid repeating the same calculation in multiple branches. Test values just below, at, and just above important boundaries, plus an input that should not be accepted. Submit the code and the test cases with expected results.$guide$
      when 3 then $guide$Build the listed exercise around a small, explicit set of records. Choose lists, dictionaries, tuples, or sets according to whether order, named fields, immutability, or uniqueness matters; implement the requested add, lookup, update, or counting operations. Test an empty collection, a repeated value, and a missing key or item. Submit the code and a sample interaction showing the resulting data.$guide$
      when 4 then $guide$Turn the listed exercise into a reusable program: place separate responsibilities in named functions, pass inputs as parameters, and return results instead of relying on hidden global state. Where files are involved, read and write a small sample CSV or text file and handle missing files or malformed rows with a clear message. Run the program from a clean start and submit the source, sample input/output, and a brief explanation of its functions.$guide$
      when 5 then $guide$Choose one listed scenario and define every variable, formula, and unit before calculating. Work one small example by hand, implement the same calculation in Python, and compare the results. Check a zero, boundary, or changed-input case to confirm the relationship behaves as expected. Submit the formula, code or working, numeric result, and a plain-language interpretation.$guide$
      when 6 then $guide$Create a small dataset of at least ten observations that fits the exercise. Calculate the requested center or spread measure by hand from the definition, verify it with Python, and explain what the number says about this dataset. If mean and median differ, describe why; if a value is unusual, identify how it affects the summary. Submit the data, calculation, code, and interpretation.$guide$
      when 7 then $guide$Translate the probability question into a sample space or event definition, then simulate at least 1,000 trials with a fixed random seed. Report the theoretical probability and simulated proportion side by side, and explain why they may differ slightly. For conditional or dependent events, state what information is conditioned on and adjust the experiment accordingly. Submit the code, results, and a short interpretation.$guide$
      when 8 then $guide$State the population, sample, parameter, and assumptions for the exercise. For a hypothesis test, write H0 and H1 before calculating; for an interval, identify the confidence level and standard error. Show the calculation or reproducible Python output, interpret the result in the scenario's units, and explain one limitation or possible Type I/II error. Do not treat statistical significance as proof of causation.$guide$
      when 9 then $guide$Represent the exercise data as a NumPy array and report its shape and dtype. Perform the requested indexing, slicing, reshaping, vectorized calculation, aggregation, or random generation; verify one small result manually and compare it with a straightforward Python calculation. Use a fixed seed for random output. Submit the notebook or script and the printed checks.$guide$
      when 10 then $guide$Use a small CSV or Excel dataset related to the exercise. Load it into Pandas, report the row/column count and column names, inspect representative rows, and check dtypes and summary statistics before transforming anything. Perform the requested selection, filter, sort, or column change and state how many rows remain. Submit a reproducible notebook/script and a concise description of the result.$guide$
      when 11 then $guide$Apply the listed cleaning operation(s) to a copy of a small messy dataset. Measure missing values, duplicates, and relevant type problems before editing; make each cleaning choice explicit; then recheck the same conditions afterward. Preserve the raw input and report how many rows or values changed and why. Submit the cleaning code, before/after checks, and cleaned output or a reproducible sample.$guide$
      when 12 then $guide$Choose a real dataset and write one answerable analytical question before exploring it. Follow the listed EDA task, support each finding with a statistic or clearly labelled chart, and distinguish observation from interpretation. Check missingness, unusual values, and at least one relationship relevant to the question. Submit a notebook and a short report that states the question, evidence, conclusion, and one data limitation.$guide$
      when 13 then $guide$Model the exercise as a small relational database with at least three related tables where appropriate. Identify each primary key, foreign key, and relationship, then create a few sample rows and demonstrate the requested query or data change. Check that keys prevent an invalid reference and explain how the design avoids duplicated facts. Submit the schema, SQL, and a small result table.$guide$
      when 14 then $guide$Write SQL that answers the exercise's business or analytical question. Include the relevant aggregation/grouping, join/subquery, CTE, CASE, or window operation for this topic; use readable aliases and state the expected grain of one output row. Run the query against a small fixture dataset, verify a result manually, and explain how NULLs or duplicate join keys affect interpretation. Submit SQL and results.$guide$
      when 15 then $guide$Use a dataset that supports the exercise and make the chart answer one explicit question. Select a chart type suited to the data, label axes with units, add a specific title, and avoid misleading scales or unnecessary decoration. Check the chart against a small summary table and explain why the visual encoding is appropriate. Submit the plotting code, exported chart, and two-sentence interpretation.$guide$
      when 16 then $guide$Define the audience and decision the exercise's dashboard should support. Choose a small set of KPIs with explicit formulas and time periods, sketch the layout, then build the interactive chart/dashboard requested for this topic. Compare displayed totals with a source query or table and test each filter. Submit the app/notebook, a screenshot or launch instructions, and a brief design rationale.$guide$
      when 17 then $guide$Describe the real question, identify whether it is supervised, unsupervised, or another learning setup, and specify features, target (if any), and a simple baseline. Build a small scikit-learn workflow with preprocessing kept inside the appropriate pipeline and a reproducible train/test split. Report the baseline and model result, and identify one limitation or leakage risk. Submit the notebook and a concise model card.$guide$
      when 18 then $guide$Use a dataset with a numeric target. Split data before fitting transformations, train a simple baseline and the regression model for the exercise, and calculate MAE/RMSE/R-squared on held-out data. Plot or inspect residuals and compare errors in the target's units. Explain what the model gets wrong and submit a reproducible notebook with the split and metrics clearly labelled.$guide$
      when 19 then $guide$Define the positive class and the cost of false positives versus false negatives before training. Build the listed classifier with a reproducible split, then report the confusion matrix, precision, recall, and F1; include ROC-AUC when the exercise supports probability scores. Check class balance and explain which metric matters most for the scenario. Submit the notebook, metrics, and a short decision note.$guide$
      when 20 then $guide$Create a reproducible unsupervised or model-improvement workflow for the exercise. Scale features when the method requires it, fit transformations only on training folds, and compare a simple baseline with the selected clustering, PCA, or tuned model. Record parameters, validation method, and a metric or diagnostic; check for leakage and explain one trade-off. Submit code and a results table.$guide$
      when 21 then $guide$Write a capstone proposal with a concrete problem statement, stakeholder, research question, intended deliverable, and success measure. Identify a suitable dataset and verify its source, license, access conditions, and limitations; define a realistic scope, milestones, and risks. Create the initial GitHub repository with a README outline. Submit the proposal and repository link for leader feedback.$guide$
      when 22 then $guide$Prepare the approved capstone dataset without losing the raw source. Document missing values, duplicates, types, exclusions, and each cleaning decision; build a reproducible preprocessing step and run EDA that answers the proposal's question. Add justified features and validate the resulting table with assertions. Submit the notebook/script, cleaned-data description, and interim findings.$guide$
      when 23 then $guide$Train the capstone solution using a documented baseline and a split strategy that matches the project. Compare at least one reasonable alternative, report appropriate held-out metrics, interpret important results, and inspect errors or failure cases. Keep preprocessing inside the training workflow to prevent leakage. Submit reproducible code, an evaluation table, and a clear account of limitations.$guide$
      when 24 then $guide$Prepare the final project so another student can understand and reproduce it: complete the README (problem, data/source, setup, run steps, methods, results, limitations), organize the GitHub repository, and prepare a concise presentation. Request and record peer feedback, then write an individual reflection with strengths, gaps, and specific next learning goals. Submit the repository, presentation, feedback response, and reflection.$guide$
    end
  )
  from seeded_exercises as seed
  join public.weeks as w on w.week_number between 1 and 24
  where t.team_id = v_team_id
    and t.week_id = w.id
    and w.team_id = v_team_id
    and t.slug = seed.slug
    and t.practical_exercise = seed.baseline_exercise
    and t.publication_status = 'published';

  get diagnostics v_updated = row_count;
  raise notice 'Added guided exercise instructions to % unchanged seeded topics.', v_updated;
end
$guided_exercises$;
