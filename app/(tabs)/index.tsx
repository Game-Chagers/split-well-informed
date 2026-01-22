import { useState, useEffect } from 'react';
import {View, ScrollView, Text, TextInput, Button, StyleSheet } from 'react-native';

const API_URL = 'http://192.168.1.178:3000';

export default function UsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/user`);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      setMessage(`Error fetching users: ${error}`);
    }
  }

  const createUser = async () => {
    try {
      if (name != '' && email != '') {
        const response = await fetch(`${API_URL}/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        const data = await response.json();
        setName('');
        setEmail('');
      } else {
        setMessage('Must enter name and email');
      }
    } catch (error) {
      setMessage(`Error creating user: ${error}`);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View>
        <Text>User Test Page</Text>
        <TextInput
          placeholder="Name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="Add User" onPress={createUser} />
      </View>

      <View>
        {message ? <Text>{message}</Text> : null}
      </View>

      <View>
        <Text>All Users</Text>
        <Button title="Refresh" onPress={fetchUsers} />
        {users.map((user) => (
          <View key={user.id}>
            <Text>ID: {user.id}</Text>
            <Text>Name: {user.name}</Text>
            <Text>Email: {user.email}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  }
});
