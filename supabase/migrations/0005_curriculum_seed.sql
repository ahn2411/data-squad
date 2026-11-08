-- ============================================================================
-- 0005_curriculum_seed.sql
-- ----------------------------------------------------------------------------
-- Seeds the complete 24-week Data Science curriculum for the
-- "Data Science Squad" team: 6 phases, 24 weeks, ~83 topics, and 12
-- real learning resources (official docs / reputable free courses).
--
-- Dependencies: This migration MUST run AFTER 0001_initial_schema.sql,
-- 0002_roadmap.sql, 0003_assignments.sql and 0004_collaboration.sql.
-- It relies on: public.teams, public.phases, public.weeks, public.topics,
-- public.learning_resources, and the enums public.phase_status,
-- public.week_status, public.topic_difficulty, public.resource_type,
-- public.publication_status.
--
-- Idempotent: the file can be re-run safely. The team is created with
-- ON CONFLICT DO NOTHING; phases, weeks and topics use ON CONFLICT DO UPDATE;
-- learning resources use a WHERE NOT EXISTS guard keyed on (team_id, url).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Ensure the team exists
-- ---------------------------------------------------------------------------
insert into public.teams (name, slug, description)
values ('Data Science Squad', 'data-science-squad', '24-week Data Science learning team.')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Phases, weeks, topics and resources (single idempotent DO block)
-- ---------------------------------------------------------------------------
do $seed$
declare
  v_team uuid := (select id from public.teams where slug = 'data-science-squad');
begin
  -- =======================================================================
  -- PHASES (6)
  -- =======================================================================
  insert into public.phases
    (team_id, title, slug, description, phase_number, start_week, end_week, status, display_order)
  values
    (v_team, 'Python Programming Fundamentals', 'python-programming-fundamentals',
     $$Build core Python programming skills: environment setup, syntax, data structures, functions, and files.$$,
     1, 1, 4, 'published', 1),
    (v_team, 'Mathematics and Statistics for Data Science', 'mathematics-and-statistics-for-data-science',
     $$Develop the mathematical and statistical literacy needed to reason about data and models.$$,
     2, 5, 8, 'published', 2),
    (v_team, 'NumPy, Pandas, and Exploratory Data Analysis', 'numpy-pandas-and-exploratory-data-analysis',
     $$Load, clean, transform, and explore real-world datasets with NumPy and Pandas.$$,
     3, 9, 12, 'published', 3),
    (v_team, 'SQL and Data Visualization', 'sql-and-data-visualization',
     $$Query relational databases with SQL and communicate insights through visualizations.$$,
     4, 13, 16, 'published', 4),
    (v_team, 'Introduction to Machine Learning', 'introduction-to-machine-learning',
     $$Learn the machine learning workflow from foundations through regression, classification, and tuning.$$,
     5, 17, 20, 'published', 5),
    (v_team, 'Capstone and Portfolio Development', 'capstone-and-portfolio-development',
     $$Apply the full curriculum to a capstone project and build a public GitHub portfolio.$$,
     6, 21, 24, 'published', 6)
  on conflict (team_id, phase_number) do update set
    title        = excluded.title,
    slug         = excluded.slug,
    description  = excluded.description,
    start_week   = excluded.start_week,
    end_week     = excluded.end_week,
    status       = excluded.status,
    display_order = excluded.display_order;

  -- =======================================================================
  -- WEEKS (24)
  -- =======================================================================
  insert into public.weeks
    (team_id, phase_id, week_number, title, slug, overview, objectives, deliverables,
     completion_criteria, status, display_order)
  values
    -- Week 1
    (v_team, (select id from public.phases where team_id=v_team and phase_number=1), 1,
     'Introduction to Python', 'introduction-to-python',
     $$Set up a Python environment and learn the building blocks of Python programs: variables, data types, operators, and input/output.$$,
     '["Introduction to programming","Introduction to Python","Python installation and environment setup","IDEs and code editors","Variables and constants","Data types","Type conversion","Input and output","Comments","Basic operators"]'::jsonb,
     '["Personal information program","Simple calculator","Temperature converter","Unit converter","Basic mathematical operations"]'::jsonb,
     '["Can write and run basic Python programs independently","Can use variables, data types, and operators correctly","Can read input and produce formatted output"]'::jsonb,
     'published', 1),
    -- Week 2
    (v_team, (select id from public.phases where team_id=v_team and phase_number=1), 2,
     'Conditional Statements and Loops', 'conditional-statements-and-loops',
     $$Write programs that make decisions with conditionals and repeat work with loops.$$,
     '["Boolean expressions","Comparison operators","Logical operators","if statements","if-else statements","elif statements","Nested conditions","for loops","while loops","break and continue","range()","Nested loops"]'::jsonb,
     '["Even and odd checker","Grade calculator","Electricity bill calculator","Multiplication tables","Number guessing game","Pattern printing","Prime number checker"]'::jsonb,
     '["Can translate simple logical problems into working Python programs","Can use conditionals and loops correctly","Can build small interactive programs"]'::jsonb,
     'published', 2),
    -- Week 3
    (v_team, (select id from public.phases where team_id=v_team and phase_number=1), 3,
     'Python Data Structures', 'python-data-structures',
     $$Organize and manipulate structured data using strings, lists, tuples, sets, and dictionaries.$$,
     '["Strings","String methods","Lists","List indexing and slicing","List methods","Tuples","Sets","Dictionaries","Dictionary methods","Nested data structures","Iteration through collections","List comprehensions"]'::jsonb,
     '["Student record management","Contact book","Word frequency counter","Shopping cart","Simple inventory system"]'::jsonb,
     '["Can store and manipulate structured information using lists, tuples, sets, and dictionaries","Can iterate through collections and use comprehensions","Can build small data-structure-based programs"]'::jsonb,
     'published', 3),
    -- Week 4
    (v_team, (select id from public.phases where team_id=v_team and phase_number=1), 4,
     'Functions, Modules, and Problem Solving', 'functions-modules-and-problem-solving',
     $$Structure code into reusable functions and modules, and handle errors and files including CSV.$$,
     '["Functions","Parameters and arguments","Return values","Default arguments","Keyword arguments","Variable scope","Lambda functions","Built-in modules","Import statements","Exception handling","File handling","Reading and writing CSV files","Basic debugging"]'::jsonb,
     '["File-based student management system","Expense tracker","CSV data reader","Reusable calculator","Mini Python project"]'::jsonb,
     '["Can develop structured, reusable Python applications","Can handle errors and read and write files including CSV","Can organize code into functions and modules"]'::jsonb,
     'published', 4),
    -- Week 5
    (v_team, (select id from public.phases where team_id=v_team and phase_number=2), 5,
     'Mathematical Foundations', 'mathematical-foundations',
     $$Build the mathematical foundation for data science: numbers, algebra, exponents, logarithms, and notation.$$,
     '["Number systems","Fractions and percentages","Ratios and proportions","Basic algebra","Equations","Functions","Exponents","Logarithms","Summation notation","Mathematical notation used in Data Science"]'::jsonb,
     '["Percentage analysis","Growth calculations","Revenue and profit calculations","Basic mathematical Python exercises"]'::jsonb,
     '["Can perform percentage, ratio, and growth calculations","Can solve basic algebraic equations","Understands exponents, logarithms, and summation notation"]'::jsonb,
     'published', 5),
    -- Week 6
    (v_team, (select id from public.phases where team_id=v_team and phase_number=2), 6,
     'Descriptive Statistics', 'descriptive-statistics',
     $$Summarize and describe datasets using measures of central tendency and dispersion.$$,
     '["Introduction to statistics","Population and sample","Variables","Qualitative data","Quantitative data","Discrete data","Continuous data","Mean","Median","Mode","Range","Variance","Standard deviation","Percentiles","Quartiles","Interquartile range"]'::jsonb,
     '["Calculate statistical measures using Python","Analyze student marks","Compare datasets","Identify outliers"]'::jsonb,
     '["Can compute mean, median, and mode using Python","Can compute variance, standard deviation, and quartiles","Can identify outliers and compare datasets"]'::jsonb,
     'published', 6),
    -- Week 7
    (v_team, (select id from public.phases where team_id=v_team and phase_number=2), 7,
     'Probability and Distributions', 'probability-and-distributions',
     $$Reason about uncertainty using probability rules and common probability distributions.$$,
     '["Introduction to probability","Sample spaces","Events","Independent and dependent events","Conditional probability","Addition and multiplication rules","Random variables","Probability distributions","Normal distribution","Binomial distribution","Expected value"]'::jsonb,
     '["Dice simulation","Coin toss simulation","Probability experiments using Python","Visualizing distributions"]'::jsonb,
     '["Can compute probabilities of events","Can simulate random experiments using Python","Understands normal and binomial distributions"]'::jsonb,
     'published', 7),
    -- Week 8
    (v_team, (select id from public.phases where team_id=v_team and phase_number=2), 8,
     'Statistical Inference', 'statistical-inference',
     $$Draw conclusions about populations from samples using confidence intervals and hypothesis tests.$$,
     '["Sampling techniques","Sampling distributions","Central Limit Theorem","Standard error","Confidence intervals","Hypothesis testing","Null and alternative hypotheses","p-values","Type I and Type II errors","Correlation","Covariance","Introduction to statistical significance"]'::jsonb,
     '["Sample analysis","Correlation calculations","Basic hypothesis testing","Statistical interpretation report"]'::jsonb,
     '["Can construct confidence intervals","Can perform basic hypothesis tests","Can compute and interpret correlation"]'::jsonb,
     'published', 8),
    -- Week 9
    (v_team, (select id from public.phases where team_id=v_team and phase_number=3), 9,
     'NumPy Fundamentals', 'numpy-fundamentals',
     $$Perform fast numerical computing with NumPy arrays, broadcasting, and vectorized operations.$$,
     '["Introduction to NumPy","Arrays","Array creation","Array dimensions","Array indexing","Slicing","Reshaping","Data types","Vectorized operations","Broadcasting","Aggregation functions","Random number generation"]'::jsonb,
     '["Array calculations","Mathematical operations","Statistical calculations using NumPy"]'::jsonb,
     '["Can create and manipulate NumPy arrays","Can use vectorized operations and broadcasting","Can compute aggregations with NumPy"]'::jsonb,
     'published', 9),
    -- Week 10
    (v_team, (select id from public.phases where team_id=v_team and phase_number=3), 10,
     'Pandas Fundamentals', 'pandas-fundamentals',
     $$Load, inspect, select, filter, and transform tabular data with Pandas.$$,
     '["Introduction to Pandas","Series","DataFrames","Reading CSV files","Reading Excel files","Data inspection","head()","tail()","shape","columns","info()","describe()","Selecting columns","Filtering rows","Indexing","Sorting","Adding and removing columns"]'::jsonb,
     '["Load real datasets","Inspect dataset structures","Filter records","Generate statistical summaries"]'::jsonb,
     '["Can load CSV and Excel data into Pandas","Can inspect and select data using Pandas methods","Can filter, sort, and modify DataFrames"]'::jsonb,
     'published', 10),
    -- Week 11
    (v_team, (select id from public.phases where team_id=v_team and phase_number=3), 11,
     'Data Cleaning and Transformation', 'data-cleaning-and-transformation',
     $$Clean and transform messy datasets using Pandas methods for missing values, strings, dates, and merges.$$,
     '["Missing values","Duplicate records","Incorrect data types","Outlier identification","Data normalization","String operations","Date and time operations","apply()","map()","groupby()","merge()","join()","concat()","Pivot tables"]'::jsonb,
     '["Clean a messy dataset","Handle missing information","Merge datasets","Generate grouped summaries"]'::jsonb,
     '["Can clean messy datasets by handling missing values and duplicates","Can transform strings, dates, and outliers","Can merge, group, and pivot data"]'::jsonb,
     'published', 11),
    -- Week 12
    (v_team, (select id from public.phases where team_id=v_team and phase_number=3), 12,
     'Exploratory Data Analysis', 'exploratory-data-analysis',
     $$Conduct an end-to-end exploratory data analysis and communicate findings with evidence.$$,
     '["What is EDA?","Asking analytical questions","Univariate analysis","Bivariate analysis","Multivariate analysis","Data distributions","Outlier analysis","Correlation analysis","Feature relationships","Data storytelling"]'::jsonb,
     '["Complete an EDA project","Write an analytical report","Present findings with evidence"]'::jsonb,
     '["Can complete an end-to-end EDA project","Can write an analytical report with evidence","Can identify and communicate key insights"]'::jsonb,
     'published', 12),
    -- Week 13
    (v_team, (select id from public.phases where team_id=v_team and phase_number=4), 13,
     'Database Fundamentals and SQL', 'database-fundamentals-and-sql',
     $$Model data in a relational database and query it with core SQL statements.$$,
     '["Introduction to databases","Relational databases","Tables, rows, and columns","Primary keys","Foreign keys","Database relationships","SQL syntax","SELECT","WHERE","ORDER BY","LIMIT","DISTINCT","INSERT","UPDATE","DELETE"]'::jsonb,
     '["Create a sample database","Insert records","Retrieve information","Filter and sort data"]'::jsonb,
     '["Can design a relational database with keys and relationships","Can write SELECT, WHERE, ORDER BY, and LIMIT queries","Can insert, update, and delete records"]'::jsonb,
     'published', 13),
    -- Week 14
    (v_team, (select id from public.phases where team_id=v_team and phase_number=4), 14,
     'Advanced SQL', 'advanced-sql',
     $$Write analytical SQL using aggregations, joins, subqueries, CTEs, and window functions.$$,
     '["Aggregate functions","COUNT()","SUM()","AVG()","MIN()","MAX()","GROUP BY","HAVING","INNER JOIN","LEFT JOIN","RIGHT JOIN","Subqueries","Common Table Expressions","CASE statements","Window functions","Data analysis with SQL"]'::jsonb,
     '["Business sales analysis","Customer analysis","Multi-table queries","SQL analytical exercises"]'::jsonb,
     '["Can write aggregations with GROUP BY and HAVING","Can join multiple tables and use subqueries","Can use CTEs, CASE, and window functions"]'::jsonb,
     'published', 14),
    -- Week 15
    (v_team, (select id from public.phases where team_id=v_team and phase_number=4), 15,
     'Data Visualization with Matplotlib and Seaborn', 'data-visualization-with-matplotlib-and-seaborn',
     $$Create clear statistical visualizations with Matplotlib and Seaborn.$$,
     '["Visualization principles","Matplotlib fundamentals","Figure and axes","Line charts","Bar charts","Histograms","Scatter plots","Box plots","Pie charts","Seaborn","Distribution plots","Heatmaps","Pair plots","Chart customization"]'::jsonb,
     '["Visualize real datasets","Compare distributions","Create correlation heatmaps"]'::jsonb,
     '["Can create standard charts with Matplotlib","Can build statistical visualizations with Seaborn","Can customize charts for clarity"]'::jsonb,
     'published', 15),
    -- Week 16
    (v_team, (select id from public.phases where team_id=v_team and phase_number=4), 16,
     'Analytical Storytelling and Dashboards', 'analytical-storytelling-and-dashboards',
     $$Communicate insights through dashboards and interactive visualizations with Plotly and Streamlit.$$,
     '["Choosing the right chart","Visual communication","Data storytelling","Dashboard design principles","KPI identification","Introduction to Plotly","Interactive charts","Introduction to Streamlit"]'::jsonb,
     '["Build an interactive data dashboard","Create a data-driven presentation","Present findings to the squad"]'::jsonb,
     '["Can choose appropriate charts for the audience","Can build an interactive dashboard with Streamlit","Can present data-driven insights clearly"]'::jsonb,
     'published', 16),
    -- Week 17
    (v_team, (select id from public.phases where team_id=v_team and phase_number=5), 17,
     'Machine Learning Foundations', 'machine-learning-foundations',
     $$Understand the machine learning workflow and run a first scikit-learn experiment.$$,
     '["Introduction to AI","Artificial Intelligence vs Machine Learning","Supervised learning","Unsupervised learning","Reinforcement learning","Features and labels","Training and testing datasets","Model lifecycle","Introduction to scikit-learn","Data preprocessing"]'::jsonb,
     '["Load a dataset","Prepare features and labels","Split training and testing datasets"]'::jsonb,
     '["Can distinguish supervised, unsupervised, and reinforcement learning","Can prepare features, labels, and train/test splits","Can run a basic scikit-learn workflow"]'::jsonb,
     'published', 17),
    -- Week 18
    (v_team, (select id from public.phases where team_id=v_team and phase_number=5), 18,
     'Regression', 'regression',
     $$Train and evaluate regression models and interpret error metrics.$$,
     '["Linear regression","Multiple linear regression","Regression assumptions","Prediction","Residuals","Mean Absolute Error","Mean Squared Error","Root Mean Squared Error","R-squared","Model evaluation"]'::jsonb,
     '["House price prediction","Salary prediction","Regression model evaluation"]'::jsonb,
     '["Can train linear and multiple regression models","Can evaluate models with MAE, MSE, RMSE, and R-squared","Can interpret residuals and model assumptions"]'::jsonb,
     'published', 18),
    -- Week 19
    (v_team, (select id from public.phases where team_id=v_team and phase_number=5), 19,
     'Classification', 'classification',
     $$Train and evaluate classification models and interpret confusion-matrix metrics.$$,
     '["Classification problems","Logistic regression","K-Nearest Neighbors","Decision trees","Random forests","Confusion matrix","Accuracy","Precision","Recall","F1-score","ROC-AUC","Class imbalance"]'::jsonb,
     '["Spam classification","Customer churn prediction","Classification model evaluation"]'::jsonb,
     '["Can train classification models including logistic regression and trees","Can evaluate with confusion matrix, precision, recall, F1, and ROC-AUC","Can handle class imbalance"]'::jsonb,
     'published', 19),
    -- Week 20
    (v_team, (select id from public.phases where team_id=v_team and phase_number=5), 20,
     'Unsupervised Learning and Model Improvement', 'unsupervised-learning-and-model-improvement',
     $$Apply unsupervised learning and improve models through tuning and validation.$$,
     '["Clustering","K-Means","Hierarchical clustering","Dimensionality reduction","PCA","Feature engineering","Overfitting","Underfitting","Cross-validation","Hyperparameter tuning","Data leakage","Model selection"]'::jsonb,
     '["Customer segmentation","Model comparison","Performance improvement"]'::jsonb,
     '["Can cluster data with K-Means and hierarchical clustering","Can reduce dimensions with PCA","Can tune models and avoid overfitting and data leakage"]'::jsonb,
     'published', 20),
    -- Week 21
    (v_team, (select id from public.phases where team_id=v_team and phase_number=6), 21,
     'Capstone Planning and Data Collection', 'capstone-planning-and-data-collection',
     $$Plan a capstone project: define the problem, collect data, and set up a Git workflow.$$,
     '["Identifying real-world problems","Selecting a project","Defining research questions","Finding public datasets","Data collection","Project requirements","Git and GitHub workflow","Project planning"]'::jsonb,
     '["Project proposal","Problem statement","Dataset selection","Initial repository"]'::jsonb,
     '["Can define a clear problem statement and research questions","Can select and collect a suitable public dataset","Can initialize a Git and GitHub repository for the project"]'::jsonb,
     'published', 21),
    -- Week 22
    (v_team, (select id from public.phases where team_id=v_team and phase_number=6), 22,
     'Data Processing and Analysis', 'data-processing-and-analysis',
     $$Process, clean, and analyze the capstone dataset through EDA and feature engineering.$$,
     '["Data preprocessing","Cleaning","EDA","Feature engineering","Statistical analysis","Visualization"]'::jsonb,
     '["Clean dataset","EDA notebook","Initial findings"]'::jsonb,
     '["Can preprocess and clean the capstone dataset","Can perform EDA and feature engineering","Can produce statistical analysis and visualizations"]'::jsonb,
     'published', 22),
    -- Week 23
    (v_team, (select id from public.phases where team_id=v_team and phase_number=6), 23,
     'Model Development and Evaluation', 'model-development-and-evaluation',
     $$Develop, evaluate, and document the capstone model.$$,
     '["Model selection","Training","Testing","Evaluation","Model comparison","Interpretation","Documentation"]'::jsonb,
     '["Working analytical or ML solution","Evaluation report","Visualizations"]'::jsonb,
     '["Can select, train, and test an appropriate model","Can evaluate and compare models","Can document the solution and results"]'::jsonb,
     'published', 23),
    -- Week 24
    (v_team, (select id from public.phases where team_id=v_team and phase_number=6), 24,
     'Final Presentation and Portfolio', 'final-presentation-and-portfolio',
     $$Present the capstone project and assemble a GitHub portfolio and reflection.$$,
     '["Project documentation","README writing","GitHub portfolio","Presentation preparation","Technical communication","Peer review","Lessons learned","Future learning roadmap"]'::jsonb,
     '["Final project","GitHub repository","Project documentation","Presentation","Individual reflection"]'::jsonb,
     '["Can deliver a final project presentation","Can publish a polished GitHub portfolio","Can reflect on lessons and plan future learning"]'::jsonb,
     'published', 24)
  on conflict (team_id, week_number) do update set
    phase_id             = excluded.phase_id,
    title                = excluded.title,
    slug                 = excluded.slug,
    overview             = excluded.overview,
    objectives           = excluded.objectives,
    deliverables         = excluded.deliverables,
    completion_criteria  = excluded.completion_criteria,
    status               = excluded.status,
    display_order        = excluded.display_order;

  -- =======================================================================
  -- TOPICS (~83)
  -- =======================================================================
  insert into public.topics
    (team_id, week_id, title, slug, description, learning_objectives,
     estimated_minutes, difficulty, practical_exercise, completion_criteria,
     display_order, publication_status)
  values
    -- ----- Week 1 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=1),
     'Getting Started with Python', 'getting-started-with-python',
     $$Set up a Python environment and explore IDEs and code editors before writing your first programs.$$,
     '["Introduction to programming","Introduction to Python","Python installation and environment setup","IDEs and code editors"]'::jsonb,
     90, 'beginner',
     $$Personal information program$$,
     '["Python is installed and runs a hello-world program","Can choose and use an IDE or editor"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=1),
     'Variables and Operators', 'variables-and-operators',
     $$Store data in variables and constants and perform calculations with basic operators.$$,
     '["Variables and constants","Basic operators"]'::jsonb,
     90, 'beginner',
     $$Simple calculator$$,
     '["Can declare and use variables","Can perform arithmetic with operators"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=1),
     'Data Types and Type Conversion', 'data-types-and-type-conversion',
     $$Work with core Python data types and convert values between types.$$,
     '["Data types","Type conversion"]'::jsonb,
     90, 'beginner',
     $$Basic mathematical operations$$,
     '["Can identify and use core data types","Can convert between types safely"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=1),
     'Input, Output, and Comments', 'input-output-and-comments',
     $$Read user input, print output, and document code with comments.$$,
     '["Input and output","Comments"]'::jsonb,
     60, 'beginner',
     $$Temperature converter
Unit converter$$,
     '["Can read and format user input","Can write clear comments"]'::jsonb,
     4, 'published'),

    -- ----- Week 2 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=2),
     'Boolean Logic and Operators', 'boolean-logic-and-operators',
     $$Evaluate conditions with boolean expressions and comparison and logical operators.$$,
     '["Boolean expressions","Comparison operators","Logical operators"]'::jsonb,
     90, 'beginner',
     $$Even and odd checker$$,
     '["Can evaluate boolean expressions","Can combine conditions with logical operators"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=2),
     'Conditional Statements', 'conditional-statements',
     $$Control program flow with if, if-else, elif, and nested conditions.$$,
     '["if statements","if-else statements","elif statements","Nested conditions"]'::jsonb,
     120, 'beginner',
     $$Grade calculator
Electricity bill calculator$$,
     '["Can write if/elif/else chains","Can nest conditions correctly"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=2),
     'For and While Loops', 'for-and-while-loops',
     $$Repeat work with for and while loops and control iteration with break and continue.$$,
     '["for loops","while loops","break and continue","range()"]'::jsonb,
     120, 'beginner',
     $$Multiplication tables
Number guessing game
Prime number checker$$,
     '["Can write for and while loops","Can use break and continue and range()"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=2),
     'Nested Loops and Patterns', 'nested-loops-and-patterns',
     $$Combine loops inside loops to solve pattern and grid problems.$$,
     '["Nested loops"]'::jsonb,
     90, 'beginner',
     $$Pattern printing$$,
     '["Can write nested loops","Can print basic patterns"]'::jsonb,
     4, 'published'),

    -- ----- Week 3 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=3),
     'Strings and String Methods', 'strings-and-string-methods',
     $$Work with text using strings and built-in string methods.$$,
     '["Strings","String methods"]'::jsonb,
     90, 'beginner',
     $$Word frequency counter$$,
     '["Can manipulate strings with methods","Can split and join text"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=3),
     'Lists and List Methods', 'lists-and-list-methods',
     $$Store ordered collections with lists, including indexing, slicing, methods, and comprehensions.$$,
     '["Lists","List indexing and slicing","List methods","List comprehensions"]'::jsonb,
     120, 'beginner',
     $$Shopping cart$$,
     '["Can index, slice, and mutate lists","Can build lists with comprehensions"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=3),
     'Tuples and Sets', 'tuples-and-sets',
     $$Use tuples for immutable sequences and sets for unique items.$$,
     '["Tuples","Sets","Iteration through collections"]'::jsonb,
     90, 'beginner',
     $$Shopping cart (immutable views)$$,
     '["Can use tuples and sets appropriately","Can iterate through collections"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=3),
     'Dictionaries and Nested Structures', 'dictionaries-and-nested-structures',
     $$Map keys to values with dictionaries and combine data structures for richer data.$$,
     '["Dictionaries","Dictionary methods","Nested data structures"]'::jsonb,
     120, 'beginner',
     $$Contact book
Student record management
Simple inventory system$$,
     '["Can use dictionaries and their methods","Can build nested data structures"]'::jsonb,
     4, 'published'),

    -- ----- Week 4 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=4),
     'Defining and Calling Functions', 'defining-and-calling-functions',
     $$Encapsulate logic in reusable functions with parameters and return values.$$,
     '["Functions","Parameters and arguments","Return values"]'::jsonb,
     120, 'beginner',
     $$Reusable calculator$$,
     '["Can define and call functions","Can use parameters and return values"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=4),
     'Function Parameters, Scope, and Lambdas', 'function-parameters-scope-and-lambdas',
     $$Use default and keyword arguments, manage scope, and write lambda functions.$$,
     '["Default arguments","Keyword arguments","Variable scope","Lambda functions"]'::jsonb,
     120, 'beginner',
     $$Reusable calculator (extended)$$,
     '["Can use default and keyword arguments","Can write lambda functions"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=4),
     'Modules and Imports', 'modules-and-imports',
     $$Organize code into modules and import built-in functionality.$$,
     '["Built-in modules","Import statements"]'::jsonb,
     60, 'beginner',
     $$Mini Python project$$,
     '["Can import and use built-in modules","Can structure a small project"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=4),
     'Error Handling and Files', 'error-handling-and-files',
     $$Handle exceptions and read and write files including CSV, with basic debugging.$$,
     '["Exception handling","File handling","Reading and writing CSV files","Basic debugging"]'::jsonb,
     150, 'beginner',
     $$File-based student management system
Expense tracker
CSV data reader$$,
     '["Can handle exceptions gracefully","Can read and write text and CSV files"]'::jsonb,
     4, 'published'),

    -- ----- Week 5 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=5),
     'Numbers, Fractions, and Proportions', 'numbers-fractions-and-proportions',
     $$Reason about number systems, fractions, percentages, ratios, and proportions.$$,
     '["Number systems","Fractions and percentages","Ratios and proportions"]'::jsonb,
     90, 'beginner',
     $$Percentage analysis
Revenue and profit calculations$$,
     '["Can compute percentages and ratios","Can apply proportions to real problems"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=5),
     'Algebra, Equations, and Functions', 'algebra-equations-and-functions',
     $$Solve basic algebraic equations and reason about functions.$$,
     '["Basic algebra","Equations","Functions"]'::jsonb,
     90, 'beginner',
     $$Growth calculations$$,
     '["Can solve linear equations","Can evaluate and interpret functions"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=5),
     'Exponents and Logarithms', 'exponents-and-logarithms',
     $$Work with exponents and logarithms as used in data science formulas.$$,
     '["Exponents","Logarithms"]'::jsonb,
     90, 'beginner',
     $$Basic mathematical Python exercises$$,
     '["Can simplify exponential expressions","Can evaluate logarithms"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=5),
     'Summation and Math Notation', 'summation-and-math-notation',
     $$Read and compute summation notation and common data-science math notation.$$,
     '["Summation notation","Mathematical notation used in Data Science"]'::jsonb,
     90, 'beginner',
     $$Basic mathematical Python exercises (notation to code)$$,
     '["Can read summation notation","Can translate notation into code"]'::jsonb,
     4, 'published'),

    -- ----- Week 6 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=6),
     'Statistics Foundations and Data Types', 'statistics-foundations-and-data-types',
     $$Understand populations, samples, variables, and qualitative vs quantitative data.$$,
     '["Introduction to statistics","Population and sample","Variables","Qualitative data","Quantitative data","Discrete data","Continuous data"]'::jsonb,
     90, 'beginner',
     $$Calculate statistical measures using Python$$,
     '["Can distinguish population and sample","Can classify data types"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=6),
     'Measures of Central Tendency', 'measures-of-central-tendency',
     $$Summarize data with mean, median, and mode.$$,
     '["Mean","Median","Mode"]'::jsonb,
     90, 'beginner',
     $$Analyze student marks$$,
     '["Can compute mean, median, and mode","Can choose the appropriate measure"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=6),
     'Measures of Dispersion', 'measures-of-dispersion',
     $$Measure spread with range, variance, and standard deviation.$$,
     '["Range","Variance","Standard deviation"]'::jsonb,
     90, 'beginner',
     $$Compare datasets$$,
     '["Can compute variance and standard deviation","Can compare dataset spread"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=6),
     'Percentiles and Quartiles', 'percentiles-and-quartiles',
     $$Quantify position with percentiles, quartiles, and the interquartile range.$$,
     '["Percentiles","Quartiles","Interquartile range"]'::jsonb,
     90, 'beginner',
     $$Identify outliers$$,
     '["Can compute quartiles and IQR","Can identify outliers with IQR"]'::jsonb,
     4, 'published'),

    -- ----- Week 7 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=7),
     'Probability Foundations', 'probability-foundations',
     $$Define probability using sample spaces and events, including independent and dependent events.$$,
     '["Introduction to probability","Sample spaces","Events","Independent and dependent events"]'::jsonb,
     120, 'beginner',
     $$Dice simulation
Coin toss simulation
Probability experiments using Python$$,
     '["Can define sample spaces and events","Can compute basic probabilities"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=7),
     'Conditional Probability and Rules', 'conditional-probability-and-rules',
     $$Apply conditional probability and the addition and multiplication rules.$$,
     '["Conditional probability","Addition and multiplication rules"]'::jsonb,
     90, 'beginner',
     $$Probability experiments using Python$$,
     '["Can compute conditional probabilities","Can apply addition and multiplication rules"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=7),
     'Random Variables and Distributions', 'random-variables-and-distributions',
     $$Model uncertainty with random variables and the normal and binomial distributions.$$,
     '["Random variables","Probability distributions","Normal distribution","Binomial distribution","Expected value"]'::jsonb,
     120, 'beginner',
     $$Visualizing distributions$$,
     '["Can compute expected value","Can describe normal and binomial distributions"]'::jsonb,
     3, 'published'),

    -- ----- Week 8 (beginner) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=8),
     'Sampling and the Central Limit Theorem', 'sampling-and-the-central-limit-theorem',
     $$Apply sampling techniques and understand sampling distributions and the Central Limit Theorem.$$,
     '["Sampling techniques","Sampling distributions","Central Limit Theorem","Standard error"]'::jsonb,
     120, 'beginner',
     $$Sample analysis$$,
     '["Can choose a sampling technique","Can explain the Central Limit Theorem"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=8),
     'Confidence Intervals and Hypothesis Testing', 'confidence-intervals-and-hypothesis-testing',
     $$Construct confidence intervals and run hypothesis tests with null and alternative hypotheses.$$,
     '["Confidence intervals","Hypothesis testing","Null and alternative hypotheses","p-values"]'::jsonb,
     150, 'beginner',
     $$Basic hypothesis testing$$,
     '["Can construct confidence intervals","Can state hypotheses and interpret p-values"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=8),
     'Errors and Statistical Significance', 'errors-and-statistical-significance',
     $$Interpret Type I and Type II errors and statistical significance.$$,
     '["Type I and Type II errors","Introduction to statistical significance"]'::jsonb,
     90, 'beginner',
     $$Statistical interpretation report$$,
     '["Can explain Type I and Type II errors","Can interpret statistical significance"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=8),
     'Correlation and Covariance', 'correlation-and-covariance',
     $$Measure and interpret the relationship between variables with correlation and covariance.$$,
     '["Correlation","Covariance"]'::jsonb,
     90, 'beginner',
     $$Correlation calculations$$,
     '["Can compute covariance and correlation","Can interpret correlation direction and strength"]'::jsonb,
     4, 'published'),

    -- ----- Week 9 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=9),
     'NumPy Arrays and Creation', 'numpy-arrays-and-creation',
     $$Create NumPy arrays in multiple ways and understand dimensions and data types.$$,
     '["Introduction to NumPy","Arrays","Array creation","Array dimensions","Data types"]'::jsonb,
     120, 'intermediate',
     $$Array calculations$$,
     '["Can create arrays from lists and built-in functions","Can inspect array shape and dtype"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=9),
     'Indexing, Slicing, and Reshaping', 'indexing-slicing-and-reshaping',
     $$Access and restructure array data with indexing, slicing, and reshaping.$$,
     '["Array indexing","Slicing","Reshaping"]'::jsonb,
     90, 'intermediate',
     $$Mathematical operations$$,
     '["Can index and slice arrays","Can reshape arrays"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=9),
     'Vectorized Operations and Broadcasting', 'vectorized-operations-and-broadcasting',
     $$Replace loops with fast vectorized operations, broadcasting, aggregations, and random numbers.$$,
     '["Vectorized operations","Broadcasting","Aggregation functions","Random number generation"]'::jsonb,
     120, 'intermediate',
     $$Statistical calculations using NumPy$$,
     '["Can use vectorized operations and broadcasting","Can compute aggregations and generate random arrays"]'::jsonb,
     3, 'published'),

    -- ----- Week 10 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=10),
     'Pandas Series and DataFrames', 'pandas-series-and-dataframes',
     $$Get started with Pandas Series and DataFrames and load CSV and Excel files.$$,
     '["Introduction to Pandas","Series","DataFrames","Reading CSV files","Reading Excel files"]'::jsonb,
     120, 'intermediate',
     $$Load real datasets$$,
     '["Can create Series and DataFrames","Can load CSV and Excel data"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=10),
     'Reading and Inspecting Data', 'reading-and-inspecting-data',
     $$Inspect datasets with head, tail, shape, columns, info, and describe.$$,
     '["Data inspection","head()","tail()","shape","columns","info()","describe()"]'::jsonb,
     90, 'intermediate',
     $$Inspect dataset structures$$,
     '["Can inspect structure and shape of a DataFrame","Can generate summary statistics"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=10),
     'Selecting and Filtering', 'selecting-and-filtering',
     $$Select columns, filter rows, and index DataFrames.$$,
     '["Selecting columns","Filtering rows","Indexing"]'::jsonb,
     90, 'intermediate',
     $$Filter records$$,
     '["Can select columns and filter rows","Can index DataFrames with loc and iloc"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=10),
     'Sorting and Modifying Columns', 'sorting-and-modifying-columns',
     $$Sort DataFrames and add or remove columns.$$,
     '["Sorting","Adding and removing columns"]'::jsonb,
     90, 'intermediate',
     $$Generate statistical summaries$$,
     '["Can sort DataFrames","Can add and remove columns"]'::jsonb,
     4, 'published'),

    -- ----- Week 11 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=11),
     'Handling Missing and Duplicate Data', 'handling-missing-and-duplicate-data',
     $$Detect and handle missing values, duplicates, and incorrect data types.$$,
     '["Missing values","Duplicate records","Incorrect data types"]'::jsonb,
     120, 'intermediate',
     $$Clean a messy dataset
Handle missing information$$,
     '["Can detect and fill or drop missing values","Can remove duplicates and fix dtypes"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=11),
     'Transforming Strings, Dates, and Outliers', 'transforming-strings-dates-and-outliers',
     $$Normalize data and work with string, date-time, and outlier handling.$$,
     '["Outlier identification","Data normalization","String operations","Date and time operations"]'::jsonb,
     120, 'intermediate',
     $$Clean a messy dataset (strings and dates)$$,
     '["Can normalize data and handle outliers","Can transform strings and dates"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=11),
     'Apply, Map, and Groupby', 'apply-map-and-groupby',
     $$Transform data with apply, map, and groupby aggregations.$$,
     '["apply()","map()","groupby()"]'::jsonb,
     120, 'intermediate',
     $$Generate grouped summaries$$,
     '["Can use apply and map for transformations","Can compute grouped aggregations"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=11),
     'Merging, Joining, and Pivoting', 'merging-joining-and-pivoting',
     $$Combine DataFrames with merge, join, and concat and reshape with pivot tables.$$,
     '["merge()","join()","concat()","Pivot tables"]'::jsonb,
     120, 'intermediate',
     $$Merge datasets$$,
     '["Can merge and concat DataFrames","Can build pivot tables"]'::jsonb,
     4, 'published'),

    -- ----- Week 12 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=12),
     'EDA Foundations and Univariate Analysis', 'eda-foundations-and-univariate-analysis',
     $$Frame EDA with analytical questions and analyze single variables and distributions.$$,
     '["What is EDA?","Asking analytical questions","Univariate analysis","Data distributions"]'::jsonb,
     120, 'intermediate',
     $$Complete an EDA project (univariate stage)$$,
     '["Can frame analytical questions","Can analyze single-variable distributions"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=12),
     'Bivariate and Multivariate Analysis', 'bivariate-and-multivariate-analysis',
     $$Explore relationships between two or more variables and feature relationships.$$,
     '["Bivariate analysis","Multivariate analysis","Feature relationships"]'::jsonb,
     120, 'intermediate',
     $$Complete an EDA project (multivariate stage)$$,
     '["Can analyze relationships between variables","Can identify feature relationships"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=12),
     'Outliers and Correlation Analysis', 'outliers-and-correlation-analysis',
     $$Detect outliers and quantify correlations across features.$$,
     '["Outlier analysis","Correlation analysis"]'::jsonb,
     90, 'intermediate',
     $$Complete an EDA project (correlation stage)$$,
     '["Can detect outliers","Can compute and interpret correlations"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=12),
     'Data Storytelling', 'data-storytelling',
     $$Turn EDA findings into a clear analytical narrative backed by evidence.$$,
     '["Data storytelling"]'::jsonb,
     90, 'intermediate',
     $$Write an analytical report
Present findings with evidence$$,
     '["Can write an analytical report","Can present findings with evidence"]'::jsonb,
     4, 'published'),

    -- ----- Week 13 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=13),
     'Relational Database Foundations', 'relational-database-foundations',
     $$Model data with tables, rows, columns, primary and foreign keys, and relationships.$$,
     '["Introduction to databases","Relational databases","Tables, rows, and columns","Primary keys","Foreign keys","Database relationships"]'::jsonb,
     90, 'intermediate',
     $$Create a sample database$$,
     '["Can design tables with keys","Can model database relationships"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=13),
     'Querying Data with SELECT', 'querying-data-with-select',
     $$Retrieve data with SELECT, WHERE, ORDER BY, LIMIT, and DISTINCT.$$,
     '["SQL syntax","SELECT","WHERE","ORDER BY","LIMIT","DISTINCT"]'::jsonb,
     120, 'intermediate',
     $$Retrieve information
Filter and sort data$$,
     '["Can write SELECT queries with WHERE and ORDER BY","Can use LIMIT and DISTINCT"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=13),
     'Modifying Data with INSERT, UPDATE, DELETE', 'modifying-data-with-dml',
     $$Change data with INSERT, UPDATE, and DELETE statements.$$,
     '["INSERT","UPDATE","DELETE"]'::jsonb,
     90, 'intermediate',
     $$Insert records$$,
     '["Can insert, update, and delete records","Can write safe UPDATE and DELETE with WHERE"]'::jsonb,
     3, 'published'),

    -- ----- Week 14 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=14),
     'Aggregations and Grouping', 'aggregations-and-grouping',
     $$Aggregate data with COUNT, SUM, AVG, MIN, MAX and GROUP BY with HAVING.$$,
     '["Aggregate functions","COUNT()","SUM()","AVG()","MIN()","MAX()","GROUP BY","HAVING"]'::jsonb,
     120, 'intermediate',
     $$Business sales analysis
SQL analytical exercises$$,
     '["Can aggregate with GROUP BY","Can filter groups with HAVING"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=14),
     'Joins and Subqueries', 'joins-and-subqueries',
     $$Combine tables with INNER, LEFT, and RIGHT joins and use subqueries.$$,
     '["INNER JOIN","LEFT JOIN","RIGHT JOIN","Subqueries"]'::jsonb,
     120, 'intermediate',
     $$Multi-table queries
Customer analysis$$,
     '["Can join multiple tables","Can write scalar and table subqueries"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=14),
     'CTEs, CASE, and Window Functions', 'ctes-case-and-window-functions',
     $$Write advanced queries with CTEs, CASE statements, and window functions.$$,
     '["Common Table Expressions","CASE statements","Window functions","Data analysis with SQL"]'::jsonb,
     150, 'intermediate',
     $$Business sales analysis (advanced)$$,
     '["Can write CTEs","Can use CASE and window functions"]'::jsonb,
     3, 'published'),

    -- ----- Week 15 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=15),
     'Visualization Principles and Matplotlib Basics', 'visualization-principles-and-matplotlib-basics',
     $$Apply visualization principles and create figures and axes with Matplotlib.$$,
     '["Visualization principles","Matplotlib fundamentals","Figure and axes"]'::jsonb,
     120, 'intermediate',
     $$Visualize real datasets$$,
     '["Can apply visualization principles","Can create figures and axes"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=15),
     'Basic Chart Types', 'basic-chart-types',
     $$Build line, bar, histogram, scatter, box, and pie charts.$$,
     '["Line charts","Bar charts","Histograms","Scatter plots","Box plots","Pie charts"]'::jsonb,
     120, 'intermediate',
     $$Compare distributions$$,
     '["Can create the core chart types","Can choose charts for the data"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=15),
     'Chart Customization', 'chart-customization',
     $$Customize titles, labels, colors, and styling for clarity.$$,
     '["Chart customization"]'::jsonb,
     60, 'intermediate',
     $$Visualize real datasets (styled)$$,
     '["Can customize titles, labels, and colors","Can produce readable charts"]'::jsonb,
     3, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=15),
     'Statistical Visualization with Seaborn', 'statistical-visualization-with-seaborn',
     $$Build distribution plots, heatmaps, and pair plots with Seaborn.$$,
     '["Seaborn","Distribution plots","Heatmaps","Pair plots"]'::jsonb,
     120, 'intermediate',
     $$Create correlation heatmaps$$,
     '["Can build Seaborn distribution and pair plots","Can create heatmaps"]'::jsonb,
     4, 'published'),

    -- ----- Week 16 (intermediate) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=16),
     'Data Storytelling and Chart Selection', 'data-storytelling-and-chart-selection',
     $$Choose the right chart and communicate a data story clearly.$$,
     '["Choosing the right chart","Visual communication","Data storytelling"]'::jsonb,
     90, 'intermediate',
     $$Create a data-driven presentation
Present findings to the squad$$,
     '["Can choose appropriate charts","Can present a data story"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=16),
     'Dashboard Design and KPIs', 'dashboard-design-and-kpis',
     $$Design dashboards around KPIs and clear layout principles.$$,
     '["Dashboard design principles","KPI identification"]'::jsonb,
     60, 'intermediate',
     $$Build an interactive data dashboard (plan)$$,
     '["Can identify KPIs","Can apply dashboard design principles"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=16),
     'Interactive Visualization with Plotly and Streamlit', 'interactive-visualization-with-plotly-and-streamlit',
     $$Build interactive charts with Plotly and assemble a dashboard with Streamlit.$$,
     '["Introduction to Plotly","Interactive charts","Introduction to Streamlit"]'::jsonb,
     150, 'intermediate',
     $$Build an interactive data dashboard$$,
     '["Can create interactive Plotly charts","Can build a Streamlit dashboard"]'::jsonb,
     3, 'published'),

    -- ----- Week 17 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=17),
     'AI and ML Foundations', 'ai-and-ml-foundations',
     $$Distinguish AI vs ML, the main learning paradigms, and the model lifecycle.$$,
     '["Introduction to AI","Artificial Intelligence vs Machine Learning","Supervised learning","Unsupervised learning","Reinforcement learning","Model lifecycle"]'::jsonb,
     90, 'advanced',
     $$Classify a problem into the right learning paradigm$$,
     '["Can distinguish AI, ML, and learning types","Can describe the model lifecycle"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=17),
     'Features, Labels, and Data Splits', 'features-labels-and-data-splits',
     $$Prepare features and labels, preprocess data, and split training and testing sets.$$,
     '["Features and labels","Training and testing datasets","Data preprocessing"]'::jsonb,
     120, 'advanced',
     $$Load a dataset
Prepare features and labels
Split training and testing datasets$$,
     '["Can separate features and labels","Can split data into train and test sets"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=17),
     'Introduction to scikit-learn', 'introduction-to-scikit-learn',
     $$Run a first end-to-end scikit-learn workflow.$$,
     '["Introduction to scikit-learn"]'::jsonb,
     90, 'advanced',
     $$Train and evaluate a simple model with scikit-learn$$,
     '["Can fit a model with scikit-learn","Can run predict and score"]'::jsonb,
     3, 'published'),

    -- ----- Week 18 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=18),
     'Linear Regression Foundations', 'linear-regression-foundations',
     $$Fit simple linear regression models and make predictions.$$,
     '["Linear regression","Prediction"]'::jsonb,
     90, 'advanced',
     $$House price prediction (simple linear regression)$$,
     '["Can fit a linear regression model","Can make predictions"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=18),
     'Multiple Regression and Assumptions', 'multiple-regression-and-assumptions',
     $$Extend to multiple linear regression and check regression assumptions.$$,
     '["Multiple linear regression","Regression assumptions"]'::jsonb,
     120, 'advanced',
     $$Salary prediction (multiple linear regression)$$,
     '["Can fit a multiple regression model","Can check key regression assumptions"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=18),
     'Regression Evaluation Metrics', 'regression-evaluation-metrics',
     $$Evaluate regression models with residuals, MAE, MSE, RMSE, and R-squared.$$,
     '["Residuals","Mean Absolute Error","Mean Squared Error","Root Mean Squared Error","R-squared","Model evaluation"]'::jsonb,
     120, 'advanced',
     $$Regression model evaluation$$,
     '["Can compute MAE, MSE, RMSE, and R-squared","Can interpret residuals and metrics"]'::jsonb,
     3, 'published'),

    -- ----- Week 19 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=19),
     'Classification Foundations and Logistic Regression', 'classification-foundations-and-logistic-regression',
     $$Frame classification problems and train logistic regression models.$$,
     '["Classification problems","Logistic regression"]'::jsonb,
     90, 'advanced',
     $$Spam classification$$,
     '["Can frame a classification problem","Can fit a logistic regression model"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=19),
     'Tree-Based Classifiers', 'tree-based-classifiers',
     $$Train KNN, decision tree, and random forest classifiers.$$,
     '["K-Nearest Neighbors","Decision trees","Random forests"]'::jsonb,
     120, 'advanced',
     $$Customer churn prediction$$,
     '["Can train KNN and tree models","Can compare tree-based classifiers"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=19),
     'Classification Evaluation Metrics', 'classification-evaluation-metrics',
     $$Evaluate classifiers with the confusion matrix, precision, recall, F1, and ROC-AUC, and handle imbalance.$$,
     '["Confusion matrix","Accuracy","Precision","Recall","F1-score","ROC-AUC","Class imbalance"]'::jsonb,
     120, 'advanced',
     $$Classification model evaluation$$,
     '["Can compute precision, recall, F1, and ROC-AUC","Can address class imbalance"]'::jsonb,
     3, 'published'),

    -- ----- Week 20 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=20),
     'Clustering Algorithms', 'clustering-algorithms',
     $$Segment data with K-Means and hierarchical clustering.$$,
     '["Clustering","K-Means","Hierarchical clustering"]'::jsonb,
     120, 'advanced',
     $$Customer segmentation$$,
     '["Can run K-Means clustering","Can interpret cluster results"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=20),
     'Dimensionality Reduction with PCA', 'dimensionality-reduction-with-pca',
     $$Reduce feature dimensions with PCA.$$,
     '["Dimensionality reduction","PCA"]'::jsonb,
     90, 'advanced',
     $$Model comparison with PCA features$$,
     '["Can apply PCA","Can choose the number of components"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=20),
     'Feature Engineering and Model Tuning', 'feature-engineering-and-model-tuning',
     $$Engineer features and improve models with cross-validation, tuning, and leakage prevention.$$,
     '["Feature engineering","Overfitting","Underfitting","Cross-validation","Hyperparameter tuning","Data leakage","Model selection"]'::jsonb,
     150, 'advanced',
     $$Model comparison
Performance improvement$$,
     '["Can engineer features and tune hyperparameters","Can detect overfitting and data leakage"]'::jsonb,
     3, 'published'),

    -- ----- Week 21 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=21),
     'Defining the Capstone Project', 'defining-the-capstone-project',
     $$Identify a real-world problem, select a project, and define research questions and requirements.$$,
     '["Identifying real-world problems","Selecting a project","Defining research questions","Project requirements","Project planning"]'::jsonb,
     120, 'advanced',
     $$Project proposal
Problem statement$$,
     '["Can write a clear problem statement","Can define research questions"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=21),
     'Data Collection and Dataset Selection', 'data-collection-and-dataset-selection',
     $$Find public datasets and collect the data needed for the capstone.$$,
     '["Finding public datasets","Data collection"]'::jsonb,
     90, 'advanced',
     $$Dataset selection$$,
     '["Can find a suitable public dataset","Can justify dataset selection"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=21),
     'Git and GitHub Workflow', 'git-and-github-workflow',
     $$Set up a Git and GitHub repository and project workflow for the capstone.$$,
     '["Git and GitHub workflow"]'::jsonb,
     120, 'advanced',
     $$Initial repository$$,
     '["Can initialize a project repository","Can use a basic Git workflow"]'::jsonb,
     3, 'published'),

    -- ----- Week 22 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=22),
     'Data Preprocessing and Cleaning', 'data-preprocessing-and-cleaning',
     $$Preprocess and clean the capstone dataset.$$,
     '["Data preprocessing","Cleaning"]'::jsonb,
     90, 'advanced',
     $$Clean dataset$$,
     '["Can produce a clean dataset","Can document cleaning steps"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=22),
     'EDA and Feature Engineering', 'eda-and-feature-engineering',
     $$Run EDA and engineer features for the capstone.$$,
     '["EDA","Feature engineering"]'::jsonb,
     120, 'advanced',
     $$EDA notebook$$,
     '["Can deliver an EDA notebook","Can engineer useful features"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=22),
     'Statistical Analysis and Visualization', 'statistical-analysis-and-visualization',
     $$Run statistical analysis and produce visualizations for the capstone.$$,
     '["Statistical analysis","Visualization"]'::jsonb,
     120, 'advanced',
     $$Initial findings$$,
     '["Can run statistical analysis","Can produce clear visualizations"]'::jsonb,
     3, 'published'),

    -- ----- Week 23 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=23),
     'Model Selection and Training', 'model-selection-and-training',
     $$Select, train, and test the capstone model.$$,
     '["Model selection","Training","Testing"]'::jsonb,
     120, 'advanced',
     $$Working analytical or ML solution$$,
     '["Can select an appropriate model","Can train and test the model"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=23),
     'Evaluation and Comparison', 'evaluation-and-comparison',
     $$Evaluate and compare models and interpret results.$$,
     '["Evaluation","Model comparison","Interpretation"]'::jsonb,
     120, 'advanced',
     $$Evaluation report$$,
     '["Can evaluate models with appropriate metrics","Can compare and interpret results"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=23),
     'Documentation and Visualization', 'documentation-and-visualization',
     $$Document the capstone solution and produce result visualizations.$$,
     '["Documentation"]'::jsonb,
     60, 'advanced',
     $$Visualizations$$,
     '["Can document the solution","Can produce result visualizations"]'::jsonb,
     3, 'published'),

    -- ----- Week 24 (advanced) -----
    (v_team, (select id from public.weeks where team_id=v_team and week_number=24),
     'Documentation and GitHub Portfolio', 'documentation-and-github-portfolio',
     $$Write project documentation, a README, and assemble a GitHub portfolio.$$,
     '["Project documentation","README writing","GitHub portfolio"]'::jsonb,
     90, 'advanced',
     $$GitHub repository
Project documentation$$,
     '["Can write a clear README","Can assemble a GitHub portfolio"]'::jsonb,
     1, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=24),
     'Presentation and Technical Communication', 'presentation-and-technical-communication',
     $$Prepare and deliver a project presentation and engage in peer review.$$,
     '["Presentation preparation","Technical communication","Peer review"]'::jsonb,
     120, 'advanced',
     $$Presentation
Final project$$,
     '["Can prepare a project presentation","Can give and incorporate peer review"]'::jsonb,
     2, 'published'),
    (v_team, (select id from public.weeks where team_id=v_team and week_number=24),
     'Reflection and Future Roadmap', 'reflection-and-future-roadmap',
     $$Reflect on lessons learned and plan a future learning roadmap.$$,
     '["Lessons learned","Future learning roadmap"]'::jsonb,
     60, 'advanced',
     $$Individual reflection$$,
     '["Can write an individual reflection","Can outline a future learning roadmap"]'::jsonb,
     3, 'published')
  on conflict (week_id, slug) do update set
    title               = excluded.title,
    description         = excluded.description,
    learning_objectives = excluded.learning_objectives,
    estimated_minutes   = excluded.estimated_minutes,
    difficulty          = excluded.difficulty,
    practical_exercise  = excluded.practical_exercise,
    completion_criteria = excluded.completion_criteria,
    display_order       = excluded.display_order,
    publication_status  = excluded.publication_status;

  -- =======================================================================
  -- LEARNING RESOURCES (12 — real URLs from curriculum section 16)
  -- Each URL is inserted once per team, guarded by WHERE NOT EXISTS on
  -- (team_id, url), and attached to the single most relevant topic.
  -- =======================================================================

  -- Python (official docs) -> Week 1
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=1) and slug='getting-started-with-python'),
         $$Python Tutorial (official docs)$$,
         'https://docs.python.org/3/tutorial/',
         'documentation',
         $$Official Python language tutorial covering syntax, data types, and core features.$$,
         'beginner', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://docs.python.org/3/tutorial/');

  -- NumPy -> Week 9
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=9) and slug='numpy-arrays-and-creation'),
         $$NumPy Learn$$,
         'https://numpy.org/learn/',
         'documentation',
         $$Official NumPy learning hub with tutorials and guides for array computing.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://numpy.org/learn/');

  -- Pandas -> Week 10
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=10) and slug='pandas-series-and-dataframes'),
         $$Pandas Getting Started$$,
         'https://pandas.pydata.org/docs/getting_started/',
         'documentation',
         $$Official Pandas getting started guide covering Series, DataFrames, and IO.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://pandas.pydata.org/docs/getting_started/');

  -- Matplotlib -> Week 15
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=15) and slug='visualization-principles-and-matplotlib-basics'),
         $$Matplotlib Tutorials$$,
         'https://matplotlib.org/stable/tutorials/',
         'documentation',
         $$Official Matplotlib tutorial collection for figures, axes, and chart types.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://matplotlib.org/stable/tutorials/');

  -- Seaborn -> Week 15
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=15) and slug='statistical-visualization-with-seaborn'),
         $$Seaborn Tutorial$$,
         'https://seaborn.pydata.org/tutorial.html',
         'documentation',
         $$Official Seaborn statistical data visualization tutorial.$$,
         'intermediate', true, 2
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://seaborn.pydata.org/tutorial.html');

  -- PostgreSQL -> Week 13
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=13) and slug='relational-database-foundations'),
         $$PostgreSQL Documentation$$,
         'https://www.postgresql.org/docs/',
         'documentation',
         $$Official PostgreSQL manual covering SQL syntax, data types, and administration.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://www.postgresql.org/docs/');

  -- SQLBolt -> Week 13
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=13) and slug='querying-data-with-select'),
         $$SQLBolt$$,
         'https://sqlbolt.com/',
         'course',
         $$Free interactive SQL lessons that run in the browser, from SELECT to advanced joins.$$,
         'intermediate', true, 2
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://sqlbolt.com/');

  -- Kaggle Learn -> Week 12
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=12) and slug='eda-foundations-and-univariate-analysis'),
         $$Kaggle Learn$$,
         'https://www.kaggle.com/learn',
         'course',
         $$Free, concise micro-courses on Python, Pandas, data visualization, and ML from Kaggle.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://www.kaggle.com/learn');

  -- scikit-learn -> Week 17
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=17) and slug='introduction-to-scikit-learn'),
         $$scikit-learn Getting Started$$,
         'https://scikit-learn.org/stable/getting_started.html',
         'documentation',
         $$Official scikit-learn getting started guide for fitting and evaluating models.$$,
         'advanced', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://scikit-learn.org/stable/getting_started.html');

  -- Streamlit -> Week 16
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=16) and slug='interactive-visualization-with-plotly-and-streamlit'),
         $$Streamlit Documentation$$,
         'https://docs.streamlit.io/',
         'documentation',
         $$Official Streamlit docs for building interactive data dashboards in Python.$$,
         'intermediate', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://docs.streamlit.io/');

  -- Git -> Week 21
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=21) and slug='git-and-github-workflow'),
         $$Git Documentation$$,
         'https://git-scm.com/doc',
         'documentation',
         $$Official Git reference and book covering version-control workflows.$$,
         'advanced', true, 1
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://git-scm.com/doc');

  -- GitHub Skills -> Week 21
  insert into public.learning_resources
    (team_id, topic_id, title, url, resource_type, description, difficulty, is_free, display_order)
  select v_team,
         (select id from public.topics where week_id=(select id from public.weeks where team_id=v_team and week_number=21) and slug='git-and-github-workflow'),
         $$GitHub Skills$$,
         'https://skills.github.com/',
         'course',
         $$Free interactive GitHub courses on pull requests, code review, and collaboration.$$,
         'advanced', true, 2
  where not exists (select 1 from public.learning_resources where team_id=v_team and url='https://skills.github.com/');

  -- =======================================================================
  -- Summary notices
  -- =======================================================================
  raise notice 'Curriculum seed complete for team %. Phases=%, Weeks=%, Topics=%, Resources=%',
    v_team,
    (select count(*) from public.phases where team_id=v_team),
    (select count(*) from public.weeks where team_id=v_team),
    (select count(*) from public.topics where team_id=v_team),
    (select count(*) from public.learning_resources where team_id=v_team);
end
$seed$;

-- ============================================================================
-- End of 0005_curriculum_seed.sql
-- ============================================================================
