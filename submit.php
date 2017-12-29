<?php
$fecha=date("d-m-y");
$hora=date("h:m:s");
$destino="jauregui.crespo@gmail.com";
$asunto="Nueva consulta";
$desde = 'From: ' .$_POST[correo];
$comentario = "
\n
Nombre: $_POST[nombre]\n
Email: $_POST[correo]\n
Telefono: $_POST[telefono]\n
Consulta: $_POST[mensaje]\n
Enviado el dia: $fecha \n
\n
";
mail($destino, $asunto, $comentario, $desde);
header("Location:index.html");
?>