import React, { useEffect } from 'react';
import AddServer from './AddServer/AddServer';
import JoinServer from './JoinServer/JoinServer';
import styles from './LoginPage.module.css';

const LoginPage = ({ setRedirect }) => {
    // 👇 CRITICAL FIX: Jaise hi login page open ho, redirect ko false karo
    useEffect(() => {
        if (setRedirect) {
            setRedirect(false);
        }
    }, [setRedirect]);

    return (
        <div className={styles.container}>
            <JoinServer />
            <AddServer />
        </div>
    );
};

export default LoginPage;