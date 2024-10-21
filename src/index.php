<?php
use Parle\{Parser, ParserException, Lexer, Token};

// Conexión a la base de datos
$mysqli = new mysqli('localhost', 'root', '', 'inverted_index');

if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

// Manejo de carga de archivos
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_FILES['textfiles'])) {
    $uploadDir = 'uploads/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    foreach ($_FILES['textfiles']['tmp_name'] as $key => $tmp_name) {
    $fileName = $_FILES['textfiles']['name'][$key];

    // Obtener la extensión del archivo
    $extension = pathinfo($fileName, PATHINFO_EXTENSION);

    // Generar un nombre de archivo único agregando un timestamp
    $uniqueFileName = pathinfo($fileName, PATHINFO_FILENAME) . "_" . time() . "." . $extension;
    
    // Construir la ruta del archivo
    $filePath = $uploadDir . $uniqueFileName;

    if (move_uploaded_file($tmp_name, $filePath)) {
        processFile($filePath, $uniqueFileName); // Usar el nombre único en lugar del original
    }
}

    generateInvertedIndex();
}



function processFile($filePath, $fileName) {
    $content = file_get_contents($filePath);
    
    preg_match_all('/\p{L}+/u', mb_strtolower($content, 'UTF-8'), $matches);
    $words = $matches[0];
    $wordCount = count($words);
    $wordFrequency = array_count_values($words);

    // Insertar en la tabla documents
    $stmt = $GLOBALS['mysqli']->prepare("INSERT INTO documents (file_name, word_count) VALUES (?, ?)");
    $stmt->bind_param("si", $fileName, $wordCount);
    $stmt->execute();
    $docId = $GLOBALS['mysqli']->insert_id;

    foreach ($wordFrequency as $word => $frequency) {
        // Actualizar la tabla dictionary
        $stmt = $GLOBALS['mysqli']->prepare("INSERT INTO dictionary (term, doc_count, total_frequency) 
                                             VALUES (?, 1, ?) 
                                             ON DUPLICATE KEY UPDATE 
                                             doc_count = doc_count + 1, 
                                             total_frequency = total_frequency + ?");
        $stmt->bind_param("sii", $word, $frequency, $frequency);
        $stmt->execute();

        // Insertar en la tabla posting
        $stmt = $GLOBALS['mysqli']->prepare("
            INSERT INTO posting (term, doc_id, frequency, text_snippet) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                frequency = frequency + VALUES(frequency), 
                text_snippet = VALUES(text_snippet)
        ");
        
        // Encontrar la posición de la palabra en el contenido
        $pos = mb_stripos($content, $word);
        
        // Calcular el inicio y fin del snippet
        $snippetLength = 50; // Longitud total del snippet
        $start = max(0, $pos - ($snippetLength / 2));
        $snippet = mb_substr($content, $start, $snippetLength, 'UTF-8');
        

        
        // Añadir elipsis si el snippet no está al principio o al final del contenido
        if ($start > 0) {
            $snippet = "..." . $snippet;
        }
        if ($start + $snippetLength < mb_strlen($content)) {
            $snippet = $snippet . "...";
        }

        $stmt->bind_param("siis", $word, $docId, $frequency, $snippet);
        $stmt->execute();
    }
}


function generateInvertedIndex() {
    // Esta función actualizaría el índice invertido en la base de datos
    // Por simplicidad, asumimos que el índice se actualiza a medida que procesamos cada archivo
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
    $sql = "SELECT d.file_name, p.text_snippet, d.doc_id, p.term,
                   SUM((p.frequency / d.word_count) * LOG(10,(SELECT COUNT(*) FROM documents) / dict.doc_count)) AS tf_idf
            FROM documents d
            JOIN posting p ON d.doc_id = p.doc_id
            JOIN dictionary dict ON p.term = dict.term
            WHERE ";
    $conditions = build_conditions($ast);
    $sql .= $conditions;
    $sql .= " GROUP BY d.file_name, p.text_snippet, d.doc_id, p.term
              ORDER BY tf_idf DESC";
    return $sql;
}

function build_conditions($node)
{
    if (!is_array($node)) {
        return $node;
    }

    switch ($node['type']) {
        case 'AND':
            return "d.doc_id IN (
                SELECT doc_id FROM posting p WHERE " . build_conditions($node['left']) . "
                INTERSECT
                SELECT doc_id FROM posting p WHERE " . build_conditions($node['right']) . "
            )";
        case 'OR':
            return '(' . build_conditions($node['left']) . ' OR ' . build_conditions($node['right']) . ')';
        case 'NOT':
            return "d.doc_id NOT IN (SELECT p.doc_id FROM posting p WHERE p.term = '" . addslashes($node['term']['value']) . "')";
        case 'WORD':
            return "p.term = '" . addslashes($node['value']) . "'";
        case 'PATRON':
            return "p.term REGEXP '" . addslashes($node['value']) . "'";
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

function cosine($query, $documents, $vocabulary)
{
    $queryVector = build_query_vector($query, $vocabulary);
    $documentsWithSimilarity = [];

    foreach ($documents as $document) {
        $documentVector = build_document_vector($document[0], $vocabulary);
        
        // Calcular la similitud del coseno
        $cosineSimilarity = cosineSimilarity($queryVector, $documentVector);
        
        // Agregar el valor de similitud al documento
        $documentWithSimilarity = $document; // Copiar el documento original
        $documentWithSimilarity[] = $cosineSimilarity; // Agregar la similitud al final

        // Almacenar el documento modificado
        $documentsWithSimilarity[] = $documentWithSimilarity;
    }

    // Ordenar los documentos por la similitud del coseno en orden descendente
    usort($documentsWithSimilarity, function($a, $b) {
        return $b[5] <=> $a[5]; // $b[5] es la similitud del coseno de $b, $a[5] es la de $a
    });

    return $documentsWithSimilarity;
}

function build_query_vector($query, $vocabulario)
{
    $pattern = "/PATRON\((.*?)\)/";  
    $replacement = "$1";
    $result = preg_replace($pattern, $replacement, $query);
    $words_to_remove = ["NOT", "AND", "OR"];
    $result = str_replace($words_to_remove, "", $result);

    $queryArray = array_filter(explode(" ", $result));

    $queryVector = [];
    foreach ($vocabulario as $palabra) {
        if (in_array($palabra[0], $queryArray)) {
            $queryVector[] = 1; 
        } else {
            $queryVector[] = 0;  
        }
    }

    return $queryVector;
}

function build_document_vector($document, $vocabulary)
{
    $file_name = 'uploads/' . $document;
   
    if (file_exists($file_name)) {
     
        $content = file_get_contents($file_name);
        
        $content_lower = strtolower($content);

        $content_clean = preg_replace('/[^\w\s]/', '', $content_lower);
      
        $words = preg_split('/[\s,]+/', $content_clean);
        
        $words_lower = array_map('trim', $words);

        $vocabulary_flat = array_column($vocabulary, 0);

        $frequency = array_fill_keys($vocabulary_flat, 0);
       
        foreach ($words_lower as $word) {
            if (array_key_exists($word, $frequency)) {
                $frequency[$word]++; 
            }
        }
    
        $documentVector = array_values($frequency);
        return $documentVector;
    } else {
        echo "The file does not exist.";
    }
}

function cosineSimilarity($arrayA, $arrayB) {
    if (count($arrayA) !== count($arrayB)) {
        throw new Exception('Arrays must be of the same length.');
    }

    $dotProduct = 0;
    for ($i = 0; $i < count($arrayA); $i++) {
        $dotProduct += $arrayA[$i] * $arrayB[$i];
    }


    $magnitudeA = 0;
    $magnitudeB = 0;
    for ($i = 0; $i < count($arrayA); $i++) {
        $magnitudeA += $arrayA[$i] ** 2;
        $magnitudeB += $arrayB[$i] ** 2;
    }

    $magnitudeA = sqrt($magnitudeA);
    $magnitudeB = sqrt($magnitudeB);

    if ($magnitudeA == 0 || $magnitudeB == 0) {
        throw new Exception('One of the arrays has zero magnitude, cannot calculate similarity.');
    }

    $cosineSimilarity = $dotProduct / ($magnitudeA * $magnitudeB);

    return $cosineSimilarity;
}

$globalQuery = null;
$astJson = null;

// Procesar la consulta
if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['query'])) {
    $query = $_POST['query'];
    global $globalQuery, $astJson;
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

        $sqlDictorary = "SELECT term FROM dictionary";
        $resultsVocabulary = $mysqli->query($sqlDictorary);

        if ($resultsVocabulary === false) {
            throw new Exception('Error en la consulta SQL: ' . $mysqli->error);
        }

        $results = $results->fetch_all();
        $vocabulario =  $resultsVocabulary->fetch_all();
        $results = cosine($query, $results, $vocabulario);

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
    <title>Búsqueda de Índice Invertido</title>
    <script>
        var astData = <?php echo $astJson ?? 'null'; ?>;
    </script>
    <script defer src="ast-renderer.js"></script>
    <script defer src="highlight.js"></script>

</head>
<body>
    <div class='title-container'>
        <h1 class='title'>Búsqueda de Índice Invertido</h1>
        <h2 class='subtitle'>Carga de Archivos y Búsqueda</h2>
    </div>

    <form method="post" action="<?php echo $_SERVER['PHP_SELF']; ?>" enctype="multipart/form-data">
        <div class='input-container'>
            <input id='file-input' type="file" name="textfiles[]" multiple accept=".txt">
            <input type="submit" value="Cargar Archivos">
        </div>
    </form>

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
    <?php if (!empty($results)): ?>
        <div class="results-container">
            <?php foreach ($results as $row): ?>
                <div class="result-item">
                    <a href="download.php?file=<?php echo urlencode($row[0]); ?>" class="download-link">
                        Descargar <?php echo htmlspecialchars($row[0]); ?>
                    </a>
                    <p class="snippet" data-terms='<?php echo htmlspecialchars(json_encode([$row[3]])); ?>'>
                        <?php echo htmlspecialchars($row[1]); ?>
                    </p>
                    <p class="similarity">Similitud del Coseno: <?php echo number_format($row[5], 4); ?></p>

                   <p class="tf-idf">TF-IDF: <?php echo number_format($row[4], 4); ?></p>
                </div>
            <?php endforeach; ?>
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