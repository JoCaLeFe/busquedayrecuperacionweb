<?php
$mysqli = new mysqli("localhost", "root", "", "movies");

if ($mysqli->connect_error) {
    die("Error de conexión: " . $mysqli->connect_error);
}

// Inicializar variables
$query = "";
$movies = [];

// Procesar la búsqueda si se envió el formulario
if (isset($_POST['query'])) {
    $query = $_POST['query'];

    $sql = "SELECT title, MATCH(title, overview) AGAINST(?) AS relevance 
            FROM movie 
            WHERE MATCH(title, overview) AGAINST(?) 
            ORDER BY relevance DESC";

    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param("ss", $query, $query);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($row = $result->fetch_assoc()) {
        $movies[] = $row;
    }

    $stmt->close();
}

$mysqli->close();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ADA 6</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>ADA 6 - Movie Search</h1>

    <!-- Formulario de búsqueda -->
    <form method="post" action="index.php">
        <input type="text" name="query" placeholder="Search for a movie..." value="<?php echo htmlspecialchars($query); ?>" required>
        <button type="submit">Search</button>
    </form>

    <!-- Resultados de la búsqueda -->
    <?php if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($movies)): ?>
        <h2>Search Results</h2>
        <ul>
            <?php foreach ($movies as $movie): ?>
                <li><strong><?php echo htmlspecialchars($movie['title']); ?></strong> - Relevance: <?php echo htmlspecialchars($movie['relevance']); ?></li>
            <?php endforeach; ?>
        </ul>
    <?php elseif ($_SERVER['REQUEST_METHOD'] === 'POST'): ?>
        <p>No results found for "<?php echo htmlspecialchars($query); ?>"</p>
    <?php endif; ?>
</body>
</html>

