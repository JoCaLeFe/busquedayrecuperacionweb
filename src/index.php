<?php
use Parle\{Parser, ParserException, Lexer, Token};

// Conexión a la base de datos
$mysqli = new mysqli('localhost', 'root', '', 'movies');

if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

function parse_query($query)
{
    $parser = new Parser();
    $parser->token('WORD');
    $parser->token('AND');
    $parser->token('OR');
    $parser->token('NOT');
    $parser->token('PATRON');
    $parser->token('LPAREN');
    $parser->token('RPAREN');

    $parser->left('AND OR');
    $prod_start = $parser->push('start', 'query');
    $prod_query = $parser->push('query', 'expression');

    $prod_expression_and = $parser->push('expression', 'expression AND expression');
    $prod_expression_or = $parser->push('expression', 'expression OR expression');
    $prod_expression_terms = $parser->push('expression', 'terms');

    $prod_terms_1 = $parser->push('terms', 'terms term');
    $prod_terms_2 = $parser->push('terms', 'term');
    $prod_terms_not = $parser->push('terms', 'NOT term');

    $prod_term_palabra = $parser->push('term', 'WORD');
    $prod_term_pattern = $parser->push('term', 'PATRON LPAREN WORD RPAREN');

    $parser->build();

    $lexer = new Lexer();
    $lexer->push('AND', $parser->tokenId('AND'));
    $lexer->push('OR', $parser->tokenId('OR'));
    $lexer->push('NOT', $parser->tokenId('NOT'));
    $lexer->push('PATRON', $parser->tokenId('PATRON'));
    $lexer->push('\(', $parser->tokenId('LPAREN'));
    $lexer->push('\)', $parser->tokenId('RPAREN'));
    $lexer->push('[a-zA-Z0-9_.áéíóúÁÉÍÓÚñÑüÜ]+', $parser->tokenId('WORD'));
    $lexer->push('\\s+', Token::SKIP);
    $lexer->build();

    $ast = [];

    if (!$parser->validate($query, $lexer)) {
        throw new ParserException('Error sintáctico');
    }

    $parser->consume($query, $lexer);

    while (Parser::ACTION_ERROR != $parser->action && Parser::ACTION_ACCEPT != $parser->action) {
        switch ($parser->action) {
            case Parser::ACTION_ERROR:
                throw new ParserException('Parser error');
            case Parser::ACTION_SHIFT:
            case Parser::ACTION_GOTO:
            case Parser::ACTION_ACCEPT:
                break;
            case Parser::ACTION_REDUCE:
                $reduction = $parser->reduceId;
                switch ($reduction) {
                    case $prod_term_palabra:
                        $word = $parser->sigil(0);
                        $ast[] = ['type' => 'WORD', 'value' => $word];
                        break;
                    case $prod_terms_1:
                        $term = array_pop($ast);
                        $terms = array_pop($ast);
                        $ast[] = ['type' => 'OR', 'left' => $terms, 'right' => $term];
                        break;
                    case $prod_expression_and:
                        $right = array_pop($ast);
                        $left = array_pop($ast);
                        $ast[] = ['type' => 'AND', 'left' => $left, 'right' => $right];
                        break;
                    case $prod_expression_or:
                        $right = array_pop($ast);
                        $left = array_pop($ast);
                        $ast[] = ['type' => 'OR', 'left' => $left, 'right' => $right];
                        break;
                    case $prod_terms_not:
                        $term = array_pop($ast);
                        $ast[] = ['type' => 'NOT', 'term' => $term];
                        break;
                    case $prod_term_pattern:
                        $pattern = $parser->sigil(2);
                        $ast[] = ['type' => 'PATRON', 'value' => $pattern];
                        break;
                }
                break;
        }
        $parser->advance();
    }

    return $ast[0];
}

function build_sql($ast)
{
    // Construir la consulta base
    global $mysqli;
    $conditions = build_conditions($ast);
    $sql = "SELECT * 
            FROM movie m
            WHERE $conditions";
    
    return $sql;
}

function build_conditions($node)
{
    if (!is_array($node)) {
        return $node;
    }

    switch ($node['type']) {
        case 'AND':
            return "MATCH(m.title, m.overview) AGAINST('+" . build_conditions($node['left']) . " +" . build_conditions($node['right']) . "' IN BOOLEAN MODE)";
        case 'OR':
            return "MATCH(m.title, m.overview) AGAINST('" . build_conditions($node['left']) . " " . build_conditions($node['right']) . "' IN BOOLEAN MODE)";
        case 'NOT':
            return "MATCH(m.title, m.overview) AGAINST('+" . build_conditions($node['left']) . " -" . build_conditions($node['right']) . "' IN BOOLEAN MODE)";
        case 'WORD':
            return addslashes($node['value']);
        // case 'PHRASE':
        //     return '"' . addslashes($node['value']) . '"'; // Coincidencia exacta
        case 'PATRON':
            return addslashes($node['value']) . '*'; // Coincidencia con comodín
        default:
            throw new Exception("Tipo de nodo desconocido: " . $node['type']);
    }
}




function ast_to_json($ast)
{
    if (!is_array($ast)) {
        return ['type' => 'leaf', 'value' => $ast];
    }

    $node = [
        'type' => 'node',
        'value' => $ast['type'] ?? 'Root (OR)',
        'children' => [],
    ];
    foreach ($ast as $key => $value) {
        if ($key !== 'type') {
            $node['children'][] = [
                'label' => $key,
                'node' => ast_to_json($value),
            ];
        }
    }
    return $node;
}

$globalQuery = null;
$astJson = null;

// Procesar la consulta
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['query'])) {
    $query = $_POST['query'];
    global $globalQuery, $astJson;
    global $mysqli;
    $globalQuery = $query;
    $error = null;

    try {
        $parsed_query = parse_query($query);
        $astJson = json_encode(ast_to_json($parsed_query));
        $sql = build_sql($parsed_query);
        $results = $mysqli->query($sql);

        if ($results === false) {
            throw new Exception('Error en la consulta SQL: ' . $mysqli->error);
        }

        $sqlText = $sql;
    } catch (ParserException $e) {
        $error = 'Error en la consulta: ' . $e->getMessage();
    } catch (mysqli_sql_exception $e) {
        $error = 'Error en la base de datos: ' . $e->getMessage();
    } catch (Exception $e) {
        $error = 'Error: ' . $e->getMessage();
    }
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="styles.css">
    <title>Búsqueda de Película</title>
    <script>
        var astData = <?php echo $astJson ?? 'null'; ?>;
    </script>
    <script defer src="ast-renderer.js"></script>
    <script defer src="highlight.js"></script>

</head>
<body>
    <div class='title-container'>
        <h1 class='title'>Búsqueda FULLTEXT</h1>
    </div>
    <form method="post" action="<?php echo $_SERVER['PHP_SELF']; ?>">
        <div class='input-container'>
            <input type="text" name="query" placeholder="Ingrese su consulta de búsqueda" required>
            <input type="submit" value="Buscar">
        </div>
        <div class='badge-container'>
            <span class='badge'>AND</span>
            <span class='badge'>OR</span>
            <span class='badge'>NOT</span>
            <span class='badge'>PATRON()</span>
        </div>
    </form>

    <?php if (isset($error)): ?>
        <div class="error"><?php echo htmlspecialchars($error); ?></div>
    <?php endif; ?>

    <?php if (isset($globalQuery)): ?>
        <div class="message"><?php echo htmlspecialchars($globalQuery); ?></div>
    <?php endif; ?>

    <?php if (isset($results)): ?>
    <div class="sql-query">
        <strong>Consulta SQL:</strong>
        <pre><?php echo htmlspecialchars($sqlText); ?></pre>
    </div>
    
    <?php if ($results->num_rows > 0): ?>
        <div class="results-container">
            <?php while ($row = $results->fetch_assoc()): ?>
                <div class="result-item">
                    <h3><?php echo htmlspecialchars($row['title']); ?></h3>
                </div>
            <?php endwhile; ?>
        </div>
    <?php else: ?>
        <span class='message'>No se encontraron resultados.</span>
    <?php endif; ?>
<?php endif; ?>


    <?php if (isset($astJson)): ?>
        <canvas id="astCanvas" width="800" height="600"></canvas>
    <?php endif; ?>
</body>
</html>