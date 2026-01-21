import { useState, useEffect } from 'react';
import { View, ScrollView, Text, TextInput, Button, StyleSheet } from 'react-native';

const API_URL = 'http://192.168.1.178:3000';

export default function GroupsScreen() {
  const [groups, setGroups] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState('');

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${API_URL}/group`);
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      setMessage(`Error fetching groups: ${error}`);
    }
  }

  const createGroup = async () => {
    try {
      if (groupName != '') {
        const response = await fetch(`${API_URL}/group`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: groupName,
            members: []   // Will need logic to select members
          }),
        });
        const data = await response.json();
        setGroupName('');
        fetchGroups();
      } else {
        setMessage('Must enter group name');
      }
    } catch (error) {
      setMessage(`Error creating group: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View>
        <Text>Group Test Page</Text>
        <TextInput
          placeholder="Name"
          value={groupName}
          onChangeText={setGroupName}
        />
        <Button title="Create Group" onPress={createGroup} />
      </View>

      <View>
        {message ? <Text>{message}</Text> : null}
      </View>

      <View>
        <Text>All Groups</Text>
        <Button title="Refresh" onPress={fetchGroups} />
        {groups.map((group) => (
          <View key={group.id}>
            <Text>ID: {group.id}</Text>
            <Text>Name: {group.name}</Text>
            <Text>Members: {group.members}</Text>
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