
// Requerimos las dependencias necesarias para el proyecto (Explicadas en la memoria)
const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path')

//----------- INICIAMOS LA APP DE EXPRESS -------------
const app = express();

// Middleware de seguridad que permite solicitudes de otros dominios
app.use(cors());
// Middleware para parsear el cuerpo de las solicitudes en formato JSON 
app.use(express.json());

/* Requerimos la dependencia dotenv para cargar y configurar
las variables de entorno desde un archivo .env */
require('dotenv').config();


// ------------ CONEXIÓN A BASE DE DATOS ----------------

// Creamos la conexión a nuestra base de datos
const db = mysql.createConnection({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:'sql8702341'
});

/* intentamos establecer la conexión a la base de datos
y manejamos cualquier error que pueda ocurrir durante el proceso */
try {
    db.connect();
    console.log( 'Conectado con éxito a la base de datos' )
} catch (error) {
    console.error( 'Error al conectar con la base de datos ' + error); 
}


//------------- CONFIGURACIÓN DE MULTER ------------------

const storage = multer.diskStorage({
    // Función con la ruta para almacenar los archivos
    destination: function (req, file, cb) {
        cb(null, '../server/imagenes')
    },
    // Función para guardar las imágenes con un nombre de archivo único
    filename: function ( req, file, cb ) {
        cb( null, Date.now()+'-'+file.originalname);
    }
});

// Middleware para servir archivos estáticos. En este caso las imágenes
app.use('/imagenes', express.static(path.join(__dirname,'imagenes')))

/* Creamos la constante upload con la que manejar el almacenamiento
de los archivos con la configuración que hemos definido arriba */ 
const upload = multer({ storage:storage });

// Ruta para manejar la carga de archivos utilizando la constante upload
app.post( '/upload', upload.single('file'), ( req, res ) => {
        /* Creamos la constante file que contiene la ruta relativa
        del archivo que hemos subido */
        const file = '/imagenes/' + req.file.filename;
        console.log(req.file.filename);
        res.json({file});
    }
)


// ------- REGISTRO EN EL BLOG CON COMPROBACION DE NOMBRE Y ENCRIPTACIÓN DE CONTRASEÑA -------

// Recogemos la solicitud post del cliente
app.post( '/registro', ( req, res ) => {
    //Guardamos los datos que nos envía el usuario desde el formulario de registro
    const { nombre, email, password } = req.body;
    console.log( req.body );

    // Comprobamos la disponibilidad del nombre elegido por el usuario
    db.query( 'SELECT nombre FROM usuarios WHERE nombre = ?',
    [ nombre ],( err, results ) => {
        // Si el resultdo es mayor a 0 significa que el usuario ya existe
        if ( results.length > 0 ) {
             console.log(results)
            // Devolvemos estado fallido
            res.json({ status:'failed' });
        } else {
            // En caso contrario el nombre no existe y podemos continuar
            // Entonces procedemos con la encriptación de la contraseña
            bcrypt.hash( password, 10, ( err, passwordEncript ) => {
                if (err) {
                    console.error( 'Error al encriptar la contraseña: ' + err );
                    // Si la encriptación falla devolvemos estado y mensaje de error
                    res.status(500).json({ err: 'Error interno del servidor' });
                } else {
                    // Si todo ha ido bien, entonces procedemos con el registro
                    db.query( 'INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)',
                        [ nombre, email, passwordEncript ], ( err, result ) => {
                            if (err) {
                                console.error( 'Error en el registro: ' + err )
                                // Si el registro falla devolvemos estado y mensaje de error
                                res.status(500).json({ err: 'Error interno al registrar usuario' });
                            } else {
                                // En caso contrario el registro ha sido exitoso
                               res.status(201).json({ message:'Registro realizado con éxito' });
                            }
                        });
                }
            });
        }
    });
});


// ------------ LOGIN CON COMPROBACIÓN DE NOMBRE Y COMPARACIÓN DE CONTRASEÑAS ------------

// Recogemos la solicitud post del cliente
app.post( '/', ( req, res ) => {
    // Guardamos los datos que nos envía el usuario desde el formulario de Login
    const { id, nombre, password } = req.body;
    console.log(req.body);

    // Comprobamos si existe el nombre de usuario
    db.query( 'SELECT * FROM usuarios WHERE nombre = ?',
    [ nombre ],( err, result ) => {
        if ( err ) {
            console.error( 'Error al buscar el usuario: ' + err );
            // Si no se puede realizar la búsqueda devolvemos estado fallido
            res.status( 500 ).json({ status: 'failed' });
            // Si el resultado de la búsqueda es igual a 0 el usuario no existe
        } else if ( result.length === 0 ) {
            // Devolvemos estado fallido
            res.json({ status: 'failed' });
        } else {
            // En caso contrario el usuario sí existe
            // Entonces comparamos su contraseña con la contraseña encriptada
            let passwordEncript = result[0].password;
            bcrypt.compare( password, passwordEncript,( err, match ) => {
                if ( err ) {
                    console.log( 'Error al comparar las contraseñas: ' + err );
                    // Si se produce un error al comparar las contraseñas devolvemos estado fallido
                    res.status( 500 ).json({ status: 'failed' });
                } else if ( match ) {
                    // Si las contraseñas coinciden, guardamos la id del usuario y enviamos mensaje de aprobación
                    db.query( 'SELECT id_usuario FROM usuarios')
                    const idUsuario = result[0].id_usuario;
                    res.status( 200 ).json({ message: ' Inicio de sesión aprobado. Accediendo...', idUsuario  });
                } else {
                    // En caso contrario, las contraseñas no coinciden, estado fallido
                    res.json({ status: 'failed' });
                }
            })
        }
    })
})


// ----------- PÁGINA DE INICIO -----------

// Tras la aprobación del login, atendemos la petición get del cliente para ir a la home
app.get( '/inicio',( req, res ) => {
    /* Recopilamos todos los posts que hay en la base de datos
    y se los enviamos al cliente para que muestre el listado */
    db.query( 'SELECT id_post,titulo,imagen,categoria FROM posts', ( err, result ) => {
        if( err ) {
            console.error( "Error en la consulta: " + err );
        }
        res.json( result );
    });
});


// --------- FILTRAR POSTS POR CATEGORIA -------------

// Recogemos la petición get del cliente
app.get('/categoria', (req, res ) => {
    /* Seleccionamos el id, la categoría y el título de cada post de nuestra base de datos
    y enviamos los resultados al cliente */
    db.query( 'SELECT id_post,titulo,imagen,categoria FROM posts', ( err, result ) => {
        if( err ) {
            console.error( "Error en la consulta: " + err );
        }
        res.json( result );
    });
});


// ----------- OPERACION CRUD: LEER POST ---------------

// Creamos una operación CRUD para que el usuario pueda leer los posts
app.get( '/postsById', ( req, res) => {
    console.log(req.query.id);
    // Devolvemos el post que corresponda en función de la id
    db.query( 'SELECT * FROM posts WHERE id_post = ?',
    [ req.query.id ],( err, result ) => {
        if ( err ) {
            console.log( 'Error en la consulta: ' + err );
        }
        res.json(result[0]);
    })
})

// Ruta para mostrar el nombre del autor del post que se está consultando
app.get('/usuariosById', (req, res) => {
    // Almanecenamos en una constante la id del autor del post 
    const userId = req.query.id;
    // Buscamos al usuario en la base de datos que corresponda a esa id
    db.query('SELECT * FROM usuarios WHERE id_usuario = ?', [userId], (err, result) => {
        if (err) {
            // Si la operación falla devolvemos estado fallido
            console.error('Error al obtener los detalles del usuario: ' + err);
            res.status(500).json({ status: 'failed' });
        } else {
            /* En caso contrario guardamos los resultados en una constante */
            const userData = result[0];
            // Si el usuario existe devolvemos sus datos al cliente
            if (userData) {    
                res.status(200).json(userData);
            } else {
                // En caso contrario devolvemos estado fallido
                res.status(404).json({ status: 'failed', message: 'Usuario no encontrado' });
            }
        }
    });
}); 


// ---------- OPERACION CRUD: CREAR POST --------------

// Creamos una operación CRUD para que el usuario pueda crear nuevos posts
app.post( '/crearPost', ( req, res ) => {
    try {
        // Recogemos los datos del post que quiere crear el usuario incluyéndole a él como autor
        const { titulo, descripcion, categoria, file, autor } = req.body;
        console.log(req.body)
        // Realizamos la inserción en la base de datos con los datos que nos ha enviado
        db.query( 'INSERT INTO posts (titulo,descripcion,categoria,imagen,autor) VALUES (?,?,?,?,?)',
        [ titulo, descripcion, categoria, file, autor ]);
        // Si todo va bien devolvemos mensaje de éxito
        res.status(200).json({ message: 'Post creado con éxito' })
        // Capturamos los posibles errores y devolvemos el mensaje correspondiente
    } catch (err) {
        console.log( 'Error al crear el post: ' + err );
        res.status(500).json({ message: 'Error al crear el post' });
    }
})


// -------- OPERACION CRUD: ACTUALIZAR POST ------------

// Creamos una operación CRUD para que el usuario pueda editar sus posts
app.put('/editarPost/:id', (req, res) => {
    // Guardamos en una variable la id del post que recibimos por parámetros
    const postId = req.params.id;
    // Guardamos la nueva información que nos envía el cliente al editar el post
    const { titulo, descripcion, file, categoria } = req.body;
    console.log('req.params:', req.params);
    console.log(req.body)
        // Realizamos la actualización del post en la base de datos
        db.query( 'UPDATE posts SET titulo = ?, descripcion = ?, imagen = ?, categoria = ? WHERE id_post = ?',
        [ titulo, descripcion, file, categoria, postId ],( err, result ) => {
            if (err) {
                console.log( 'Error al editar el post: ' + err )
                // Si hay errores mostramos estado de error
                res.status(500).json({ err: 'Error al editar el post' })
            } else {
                // En caso contrario devolvemos mensaje de éxito
                res.status(200).json({message: 'Post actualizado correctamente' })
            }
        })
})
   

// ---------- OPERACION CRUD: ELIMINAR POST -------------

// Creamos una operación CRUD para que el usuario pueda borrar sus posts
app.delete( '/postsById', ( req, res) => {
    // Guardamos en una constante la id del post que el cliente nos indica que quiere borrar
    const idPost = req.query.id;
    // Realizamos el borrado del post con esa id de la base de datos
    db.query( 'DELETE FROM posts WHERE id_post = ?', [ idPost ], ( err, result) => {
        if (err) {
            console.log( 'Error al borrar el post: ' +err);
            // Si hay errores mostramos estado de error
            res.status( 500 ).json({ status: 'failed' });
        } else {
            // En caso contrario mostramos mensaje de éxito
            res.status(200).json( {message: 'Publicación eliminada correctamente' })
        }
    })
})

// Ponemos a escuchar nuestro sevidor en el puerto 3000
app.listen(3000, () => {
    console.log('Servidor levantado')
});
