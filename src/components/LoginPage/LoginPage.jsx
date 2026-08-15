import React, { useEffect } from 'react';
import AddServer from './AddServer/AddServer';
import JoinServer from './JoinServer/JoinServer';
import styles from './LoginPage.module.css';

const LoginPage = ({ setRedirect }) => {
    // 🔥 IMPORTANT: Jab login page open ho, redirect false karo
    useEffect(() => {
        setRedirect(false);
    }, [setRedirect]);

    return (
        <div className={styles.container}>
            <JoinServer />
            <AddServer />
        </div>
    );
};

export default LoginPage;